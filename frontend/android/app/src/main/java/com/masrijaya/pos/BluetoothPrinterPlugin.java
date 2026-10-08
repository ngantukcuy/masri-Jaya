package com.masrijaya.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Plugin Capacitor untuk printer thermal Bluetooth Classic (SPP / RFCOMM).
 *
 * Kenapa perlu plugin native: WebView di dalam APK TIDAK mendukung Web
 * Bluetooth maupun WebUSB (itu API khusus Chrome desktop/Android browser),
 * dan hampir semua printer thermal 58mm murah memakai Bluetooth Classic
 * (bukan BLE). Jadi di APK, koneksi harus lewat Android API asli.
 *
 * Alur: printer dipasangkan (pair) sekali lewat Pengaturan Bluetooth HP,
 * lalu app menampilkan daftar perangkat yang sudah paired, user pilih,
 * lalu byte ESC/POS dikirim lewat socket RFCOMM.
 */
@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        // Hanya dipakai di Android 12+ (API 31). Di bawah itu izin Bluetooth
        // bersifat install-time, jadi tidak perlu diminta saat runtime.
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    // UUID standar Serial Port Profile — dipakai hampir semua printer thermal.
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int WRITE_CHUNK = 512;

    private final Map<String, BluetoothSocket> sockets = new HashMap<>();
    private final Map<String, OutputStream> streams = new HashMap<>();
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private BroadcastReceiver aclReceiver;

    // ---- Permission helpers -------------------------------------------------

    private boolean needsRuntimePermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (needsRuntimePermission()) {
            call.reject("Izin Bluetooth ditolak. Aktifkan izin \"Perangkat di sekitar\" untuk app ini di Pengaturan HP.");
            return;
        }
        String method = call.getMethodName();
        if ("listPairedDevices".equals(method)) {
            doList(call);
        } else if ("connect".equals(method)) {
            doConnect(call);
        } else {
            call.resolve();
        }
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    // ---- Plugin methods -----------------------------------------------------

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (needsRuntimePermission()) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback");
            return;
        }
        doList(call);
    }

    @SuppressLint("MissingPermission")
    private void doList(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("HP ini tidak punya Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth HP masih mati. Nyalakan Bluetooth dulu.");
            return;
        }
        JSArray devices = new JSArray();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded != null) {
            for (BluetoothDevice device : bonded) {
                JSObject item = new JSObject();
                String name = device.getName();
                item.put("name", name == null || name.isEmpty() ? device.getAddress() : name);
                item.put("address", device.getAddress());
                BluetoothClass cls = device.getBluetoothClass();
                // Major class IMAGING (0x0600) = printer/scanner/kamera. Hanya petunjuk
                // supaya printer tampil paling atas; semua perangkat paired tetap ditampilkan.
                item.put("isPrinter", cls != null && cls.getMajorDeviceClass() == BluetoothClass.Device.Major.IMAGING);
                devices.put(item);
            }
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (needsRuntimePermission()) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback");
            return;
        }
        doConnect(call);
    }

    @SuppressLint("MissingPermission")
    private void doConnect(final PluginCall call) {
        final String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Alamat printer tidak diberikan.");
            return;
        }
        final BluetoothAdapter adapter = adapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth HP masih mati. Nyalakan Bluetooth dulu.");
            return;
        }
        io.execute(() -> {
            synchronized (sockets) {
                if (sockets.containsKey(address)) {
                    call.resolve();
                    return;
                }
            }
            BluetoothSocket socket = null;
            try {
                BluetoothDevice device = adapter.getRemoteDevice(address);
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                try {
                    socket.connect();
                } catch (IOException first) {
                    // Sebagian printer murah menolak socket "secure" standar —
                    // coba jalur RFCOMM channel 1 (cara lama yang tetap dipakai banyak app kasir).
                    try { socket.close(); } catch (IOException ignored) {}
                    socket = (BluetoothSocket) device.getClass()
                        .getMethod("createRfcommSocket", int.class)
                        .invoke(device, 1);
                    socket.connect();
                }
                OutputStream out = socket.getOutputStream();
                synchronized (sockets) {
                    sockets.put(address, socket);
                    streams.put(address, out);
                }
                registerAclReceiver();
                call.resolve();
            } catch (Exception e) {
                if (socket != null) {
                    try { socket.close(); } catch (IOException ignored) {}
                }
                call.reject("Gagal terhubung ke printer. Pastikan printer menyala, ada di dekat HP, dan tidak sedang tersambung ke HP lain. (" + e.getMessage() + ")");
            }
        });
    }

    @PluginMethod
    public void write(final PluginCall call) {
        final String address = call.getString("address");
        final String data = call.getString("data");
        if (address == null || data == null) {
            call.reject("Data cetak tidak lengkap.");
            return;
        }
        io.execute(() -> {
            OutputStream out;
            synchronized (sockets) {
                out = streams.get(address);
            }
            if (out == null) {
                call.reject("Printer belum tersambung.");
                return;
            }
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                for (int i = 0; i < bytes.length; i += WRITE_CHUNK) {
                    out.write(bytes, i, Math.min(WRITE_CHUNK, bytes.length - i));
                    out.flush();
                }
                call.resolve();
            } catch (IOException e) {
                closeQuietly(address);
                notifyDisconnected(address);
                call.reject("Koneksi ke printer terputus saat mencetak. Nyalakan printer lalu sambungkan lagi. (" + e.getMessage() + ")");
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String address = call.getString("address");
        if (address != null) closeQuietly(address);
        call.resolve();
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        String address = call.getString("address");
        boolean connected;
        synchronized (sockets) {
            BluetoothSocket socket = address == null ? null : sockets.get(address);
            connected = socket != null && socket.isConnected();
        }
        JSObject result = new JSObject();
        result.put("connected", connected);
        call.resolve(result);
    }

    // ---- Internals ----------------------------------------------------------

    private void closeQuietly(String address) {
        BluetoothSocket socket;
        synchronized (sockets) {
            socket = sockets.remove(address);
            streams.remove(address);
        }
        if (socket != null) {
            try { socket.close(); } catch (IOException ignored) {}
        }
    }

    private void notifyDisconnected(String address) {
        JSObject payload = new JSObject();
        payload.put("address", address);
        notifyListeners("disconnected", payload);
    }

    // Printer dimatikan / keluar jangkauan -> Android kirim ACL_DISCONNECTED.
    @SuppressLint("MissingPermission")
    private void registerAclReceiver() {
        if (aclReceiver != null) return;
        aclReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device == null) return;
                String address = device.getAddress();
                boolean wasOurs;
                synchronized (sockets) {
                    wasOurs = sockets.containsKey(address);
                }
                if (wasOurs) {
                    closeQuietly(address);
                    notifyDisconnected(address);
                }
            }
        };
        ContextCompat.registerReceiver(
            getContext(),
            aclReceiver,
            new IntentFilter(BluetoothDevice.ACTION_ACL_DISCONNECTED),
            ContextCompat.RECEIVER_EXPORTED
        );
    }

    @Override
    protected void handleOnDestroy() {
        if (aclReceiver != null) {
            try { getContext().unregisterReceiver(aclReceiver); } catch (Exception ignored) {}
            aclReceiver = null;
        }
        String[] addresses;
        synchronized (sockets) {
            addresses = sockets.keySet().toArray(new String[0]);
        }
        for (String address : addresses) closeQuietly(address);
        io.shutdown();
    }
}
