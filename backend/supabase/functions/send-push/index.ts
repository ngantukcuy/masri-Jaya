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
const ENTITY_NAMES: Record<string,string> = {
  products:"Produk",
  customers:"Pelanggan",
  suppliers:"Supplier",
  sales_invoices:"Transaksi",
  purchase_orders:"Purchase Order",
  returns:"Retur",
  expenses:"Pengeluaran",
  activities:"Aktivitas",
  staff_list:"Staff",
  branches:"Cabang",
  banners:"Banner",
  printers:"Printer",
  bank_accounts:"Rekening",
  digital_orders:"Pesanan Digital",
  product_categories:"Kategori",
  product_brands:"Brand",
  product_units:"Satuan",
  product_bundles:"Bundle",
  sku_locations:"Lokasi SKU",
  opname_submissions:"Stock Opname"
};
const rupiah=(n:number)=>
`Rp ${Math.round(n||0).toLocaleString("id-ID")}`;
function entity(table:string){
    return ENTITY_NAMES[table]??table;
}
function getData(record:any){
    return record?.data??{};
}
function getIdentifier(data:any){
    return(
        data.invoiceNumber??
        data.name??
        data.customerName??
        data.supplierName??
        data.orderNumber??
        data.purchaseOrderNumber??
        data.title??
        data.sku??
        data.code??
        data.id??
        "Data"
    );
}
function buildInsert(
    table:string,
    data:any
):PushPayload{
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
    if(table==="customers"){
        return{
            title:"👤 Customer Baru",
            body:data.customerName??data.name,
            data:{
                table,
                action:"INSERT"
            }
        };
    }
    if(table==="suppliers"){
        return{
            title:"🚚 Supplier Baru",
            body:data.supplierName??data.name,
            data:{
                table,
                action:"INSERT"
            }
        };
    }
    if(table==="purchase_orders"){
        return{
            title:"📦 Purchase Order",
            body:getIdentifier(data),
            data:{
                table,
                action:"INSERT"
            }
        };
    }
    if(table==="expenses"){
        return{
            title:"💸 Pengeluaran",
            body:
`${getIdentifier(data)}
${rupiah(data.amount??0)}`,
            data:{
                table,
                action:"INSERT"
            }
        };
    }
    return{
        title:`➕ ${entity(table)} Baru`,
        body:
`${getIdentifier(data)}
berhasil ditambahkan`,
        data:{
            table,
            action:"INSERT"
        }
    };
}
// Field-field "identitas" pelanggan — perubahan di sini layak dinotifikasi
// (mis. Admin mengedit nama/telepon/alamat lewat halaman Pelanggan).
// SENGAJA tidak termasuk field finansial rutin (points, totalPurchases,
// currentDebt, debtStatus, pendingAmount, overdueAmount, depositBalance,
// nextDueDate, lastTransactions) — field-field itu selalu ikut ter-update
// otomatis tiap ada transaksi POS/setor deposit/tambah-bayar hutang. Dulu
// SETIAP transaksi = 1 notif "Transaksi Baru" (dari sales_invoices) DITAMBAH
// 1 notif "Pelanggan diperbarui" (dari customers) yang isinya cuma bilang
// "berhasil diperbarui" tanpa detail apa yang berubah — jadi terasa spam
// padahal cuma 1 transaksi. Sekarang update customers cuma dinotif kalau
// benar-benar ada perubahan data identitas pelanggannya.
const CUSTOMER_IDENTITY_FIELDS = [
    "name",
    "phone",
    "address",
    "customerType",
    "paymentTerms",
    "tempoDays",
    "creditLimit",
    "loyaltyTier"
];
function customerIdentityChanged(oldData:any,newData:any):boolean{
    return CUSTOMER_IDENTITY_FIELDS.some(
        (field)=>JSON.stringify(oldData?.[field])!==JSON.stringify(newData?.[field])
    );
}
function buildUpdate(
    table:string,
    oldData:any,
    newData:any
):PushPayload|null{
    if(table==="customers"){
        // Bukan perubahan identitas (cuma bump poin/piutang/deposit/riwayat
        // dari transaksi) — jangan kirim notif terpisah, sudah terwakili
        // oleh notif transaksinya sendiri (kalau ada).
        if(!customerIdentityChanged(oldData,newData)){
            return null;
        }
    }
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
    return{
        title:`✏️ ${entity(table)}`,
        body:
`${getIdentifier(newData)}
berhasil diperbarui`,
        data:{
            table,
            action:"UPDATE"
        }
    };
}
function buildDelete(
    table:string,
    data:any
):PushPayload{
    return{
        title:`🗑️ ${entity(table)}`,
        body:
`${getIdentifier(data)}
berhasil dihapus`,
        data:{
            table,
            action:"DELETE"
        }
    };
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

