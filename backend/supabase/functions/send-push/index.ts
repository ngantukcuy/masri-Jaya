// Supabase Edge Function: send-push
// Tokku POS Notification System v2
import { createClient } from "npm:@supabase/supabase-js@2";
import { createFcmSender, PushPayload } from "./fcm.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")!;
const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY
);
const rupiah=(n:number)=>
`Rp ${Math.round(n||0).toLocaleString("id-ID")}`;
function getData(record:any){
    return record?.data??{};
}
// PENTING — daftar notif sekarang SENGAJA dibatasi (allow-list), bukan
// "semua tabel dapat notif generik secara default" seperti sebelumnya.
// Alasannya: kalau ada Database Webhook lain yang (sengaja/tidak sengaja)
// dipasang di tabel selain sales_invoices/products, tabel itu akan jatuh
// ke fallback generik "✏️/➕/🗑️ ... berhasil diperbarui/ditambahkan/
// dihapus" — pesan yang nggak informatif dan gampang numpuk saat satu
// transaksi POS menyentuh banyak baris (customers, products per item
// keranjang, dst). Sekarang HANYA 2 jenis event yang benar-benar push:
//   1) sales_invoices INSERT -> "Transaksi Baru"
//   2) products UPDATE -> stok jadi "Low Stock" / "Out of Stock"
// Semua INSERT/UPDATE/DELETE lain (termasuk customers, suppliers,
// purchase_orders, expenses, dll) TIDAK lagi memicu push — tetap kelihatan
// normal di halaman Aktivitas dalam app, cuma nggak nongol sebagai notif
// yang muncul walau app ditutup. Mau tambah notif penting yang baru?
// Tambahkan cabang khusus di buildInsert/buildUpdate di bawah (jangan
// pakai fallback generik lagi).
function buildInsert(
    table:string,
    data:any
):PushPayload|null{
    if(table==="sales_invoices"){
        return{
            title:"💰 Transaksi Baru",
            body:
`${data.invoiceNumber}
${data.customerName}
${rupiah(data.total)}`,
            data:{
                table,
                action:"INSERT"
            }
        };
    }
    return null;
}
function buildUpdate(
    table:string,
    oldData:any,
    newData:any
):PushPayload|null{
    if(table==="products"){
        if(
            oldData.stockStatus!==
            newData.stockStatus
        ){
            if(
                newData.stockStatus==="Low Stock"
            ){
                return{
                    title:"⚠️ Stok Menipis",
                    body:
`${newData.name}
Sisa ${newData.stock} ${newData.unit}`,
                    data:{
                        table,
                        action:"LOW_STOCK"
                    }
                };
            }
            if(
                newData.stockStatus==="Out of Stock"
            ){
                return{
                    title:"❌ Stok Habis",
                    body:newData.name,
                    data:{
                        table,
                        action:"OUT_OF_STOCK"
                    }
                };
            }
        }
    }
    // Semua UPDATE lain (customers, harga produk, dst) sengaja tidak
    // memicu push lagi — lihat catatan besar di atas buildInsert().
    return null;
}
// DELETE juga sengaja tidak memicu push lagi (bukan event mendesak yang
// perlu nongol sebagai notif interupsi) — konsisten dengan allow-list di
// buildInsert()/buildUpdate() di atas.
function buildDelete(
    _table:string,
    _data:any
):PushPayload|null{
    return null;
}
function buildNotificationPayload(
    webhook:any
):PushPayload|null{
    const table=webhook.table;
    const action=webhook.type;
    const record=getData(webhook.record);
    const oldRecord=getData(webhook.old_record);
    switch(action){
        case "INSERT":
            return buildInsert(
                table,
                record
            );
        case "UPDATE":
            return buildUpdate(
                table,
                oldRecord,
                record
            );
        case "DELETE":
            return buildDelete(
                table,
                oldRecord
            );
        default:
            return null;
    }
}
// PENTING: nilai-nilai ini harus PERSIS sama dengan `StaffRole` di
// frontend/src/lib/permissions.ts ('Owner' | 'Admin' | 'Kasir' | 'Stoker').
// Sebelumnya di sini dipakai 'owner'/'admin'/'warehouse' (huruf kecil, dan
// 'warehouse' bukan role yang pernah ada) sehingga tidak akan PERNAH cocok
// dengan role asli staff — akibatnya query token selalu kosong dan push
// notification tidak pernah terkirim ke siapa pun.
function rolesForTable(
    table:string
):string[]{
    switch(table){
        case "sales_invoices":
            return[
                "Owner",
                "Admin"
            ];
        case "products":
            return[
                "Owner",
                "Admin",
                "Stoker"
            ];
        case "purchase_orders":
            return[
                "Owner",
                "Admin",
                "Stoker"
            ];
        case "suppliers":
            return[
                "Owner",
                "Admin"
            ];
        case "customers":
            return[
                "Owner",
                "Admin"
            ];
        case "expenses":
            return[
                "Owner",
                "Admin"
            ];
        default:
            return[
                "Owner"
            ];
    }
}
// PENTING: tabel `push_tokens` (lihat backend/supabase/schema.sql) cuma
// punya kolom `key` dan `data` (jsonb) — TIDAK ada kolom `role` atau
// `branch_id` sendiri (sama seperti semua tabel entitas lain di project
// ini). Sebelumnya kode ini melakukan `.select("key,role,branch_id")` yang
// akan gagal (kolom tidak ada) setiap kali dipanggil. Role & branch device
// disimpan di dalam `data` (lihat frontend/src/lib/push/pushNotifications.ts),
// jadi filternya dilakukan di sini terhadap isi `data`.
async function loadTokens(
    table:string,
    branchId?:string
){
    const{
        data,
        error
    }=await supabase
    .from("push_tokens")
    .select("key,data");
    if(error)
        throw error;
    
    const allowedRoles=rolesForTable(table);
    return(data??[]).filter((row:any)=>{
        const role=row?.data?.role;
        if(!role||!allowedRoles.includes(role))
            return false;
        if(branchId){
            const rowBranch=row?.data?.branchId;
            if(rowBranch&&rowBranch!==branchId)
                return false;
        }
        return true;
    });
}
async function sendNotification(
    payload:PushPayload,
    table:string,
    branchId?:string
){
    const rows=
    await loadTokens(
        table,
        branchId
    );
    if(rows.length===0){
        return{
            sent:0,
            removed:0
        };
    }
    const sender=
    await createFcmSender(
        FCM_SERVICE_ACCOUNT_JSON
    );
    let sent=0;
    const stale:string[]=[];
    for(
        const token
        of rows
    ){
        const result=
        await sender.send(
            token.key,
            payload
        );
        if(result.ok)
            sent++;
        if(
            result.shouldRemoveToken
        ){
            stale.push(
                token.key
            );
        }
    }
    if(
        stale.length>0
    ){
        await supabase
        .from(
            "push_tokens"
        )
        .delete()
        .in(
            "key",
            stale
        );
    }
    return{
        sent,
        removed:
        stale.length
    };
}
// PENTING: bug utama yang bikin push notification tidak pernah terkirim —
// seluruh file di atas ini cuma mendefinisikan fungsi, tapi tidak ada satu
// pun yang benar-benar menjalankan server HTTP. Supabase Edge Function
// TIDAK akan merespons request apa pun (termasuk dari Database Webhook)
// tanpa `Deno.serve(...)` di bawah ini. Tanpa baris ini, function-nya
// "ada" (berhasil dideploy) tapi diam saja setiap kali dipanggil.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const webhook = await req.json();
    const payload = buildNotificationPayload(webhook);
    if (!payload) {
      // Event yang tidak kita kenali (mis. tipe webhook lain) — bukan
      // error, cuma tidak ada notif yang perlu dikirim.
      return new Response(
        JSON.stringify({ skipped: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const table = webhook.table as string;
    const record = getData(webhook.record);
    const oldRecord = getData(webhook.old_record);
    // branchId bersifat opsional — dipakai kalau nanti staff sudah
    // diasosiasikan ke cabang tertentu; kalau tidak ada, notif dikirim ke
    // semua device dengan role yang sesuai (lihat rolesForTable/loadTokens).
    const branchId = record.branchId ?? oldRecord.branchId ?? undefined;
    const result = await sendNotification(payload, table, branchId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-push] Gagal memproses webhook:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

