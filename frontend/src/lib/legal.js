// Templates — fields in [KÖŞELİ PARANTEZ] must be filled with real business info before going live.
const S = "[ŞİRKET UNVANI]";
const ADDR = "[AÇIK ADRES]";
const MERSIS = "[MERSİS NO]";
const VKN = "[VERGİ DAİRESİ / VERGİ NO]";
const TEL = "[TELEFON]";
const KEP = "[KEP ADRESİ]";

export const LEGAL_PAGES = {
  hakkimizda: {
    title: "Hakkımızda",
    sections: [
      ["Luma Petshop", "Luma Petshop; köpek, kedi, kuş, balık ve kemirgen dostlarımız için mama, oyuncak, aksesuar ve bakım ürünleri sunan bir çevrim içi evcil hayvan mağazasıdır."],
      ["Neden Luma?", "Ürünlerimizi güvenilir tedarikçilerden temin eder, siparişlerinizi özenle paketler ve hızlı teslimat için çalışırız. Kapıda nakit veya kartla ödeme seçenekleri sunarız."],
      ["Şirket Bilgileri", `Unvan: ${S}\nAdres: ${ADDR}\n${VKN}\n${MERSIS}`],
    ],
  },
  iletisim: {
    title: "İletişim",
    contact: true,
    sections: [
      ["Bize Ulaşın", `E-posta: info@lumapetshop.com.tr\nTelefon: ${TEL}\nAdres: ${ADDR}`],
      ["Çalışma Saatleri", "[ÇALIŞMA SAATLERİ — ör. Hafta içi 09:00–18:00]"],
      ["Resmî Bilgiler", `Unvan: ${S}\n${VKN}\n${MERSIS}\nKEP: ${KEP}`],
    ],
  },
  "gizlilik-politikasi": {
    title: "Gizlilik Politikası",
    sections: [
      ["Kapsam", `Bu politika, ${S} ("Luma Petshop") tarafından işletilen internet sitesini kullanırken paylaştığınız bilgilerin nasıl toplandığını, kullanıldığını ve korunduğunu açıklar.`],
      ["Toplanan Bilgiler", "Üyelik için e-posta adresiniz; sipariş için ad-soyad, telefon, teslimat adresi ve sipariş içeriğiniz; ürün değerlendirmelerinde girdiğiniz görünen ad ve yorumunuz; favori ürün listeniz."],
      ["Ödeme Bilgileri", "Kart bilgileriniz sitemizde veya veritabanımızda saklanmaz. Online ödeme aktif edildiğinde kart bilgileri doğrudan lisanslı ödeme kuruluşunun (iyzico) güvenli sayfasında işlenir."],
      ["Kullanım Amaçları", "Siparişlerin hazırlanması ve teslimatı, sipariş/durum bildirimlerinin e-posta ile iletilmesi, favori ürünlerdeki fiyat düşüşlerinin bildirilmesi, müşteri hizmetleri ve yasal yükümlülüklerin yerine getirilmesi."],
      ["Paylaşım", "Bilgileriniz yalnızca hizmetin gerektirdiği ölçüde kargo firmaları, barındırma/veritabanı, e-posta ve ödeme hizmet sağlayıcılarıyla ve yasal zorunluluk hâlinde yetkili kurumlarla paylaşılır."],
      ["Güvenlik", "Veriler şifreli bağlantı (HTTPS) üzerinden iletilir, yetkisiz erişime karşı rol tabanlı yetkilendirme ve veritabanı erişim kısıtlamaları uygulanır."],
      ["İletişim", "Sorularınız için info@lumapetshop.com.tr adresine yazabilirsiniz. Kişisel verilerinize ilişkin haklarınız için KVKK Aydınlatma Metni'ni inceleyiniz."],
    ],
  },
  kvkk: {
    title: "KVKK Aydınlatma Metni",
    sections: [
      ["Veri Sorumlusu", `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu: ${S}, ${ADDR}, ${MERSIS}.`],
      ["İşlenen Kişisel Veriler", "Kimlik (ad-soyad), iletişim (e-posta, telefon, adres), müşteri işlem (sipariş, ödeme yöntemi, fatura/teslimat bilgileri), işlem güvenliği (oturum ve erişim kayıtları), pazarlama dışı tercih verileri (favoriler, değerlendirmeler)."],
      ["İşleme Amaçları", "Mesafeli satış sözleşmesinin kurulması ve ifası, siparişlerin teslimi, müşteri ilişkileri yönetimi, faturalandırma, bilgi güvenliğinin sağlanması, yasal yükümlülüklerin yerine getirilmesi ve talep/şikâyetlerin yönetimi."],
      ["Hukuki Sebepler", "KVKK m.5/2 (c) sözleşmenin kurulması veya ifası, (ç) hukuki yükümlülüğün yerine getirilmesi, (f) meşru menfaat; açık rıza gerektiren işlemler için m.5/1 kapsamında açık rıza."],
      ["Aktarım", "Kişisel verileriniz; kargo şirketleri, barındırma, veritabanı, e-posta ve ödeme hizmeti sağlayıcıları ile yetkili kamu kurumlarına KVKK m.8 ve m.9'a uygun olarak aktarılabilir. Yurt dışında bulunan hizmet sağlayıcılara aktarım için KVKK m.9 kapsamındaki şartlar sağlanır. [KULLANILAN HİZMET SAĞLAYICILARIN LİSTESİNİ VE AKTARIM DAYANAĞINI HUKUK DANIŞMANINIZLA NETLEŞTİRİN]"],
      ["Toplama Yöntemi", "Veriler internet sitesi üzerindeki üyelik, sipariş, değerlendirme ve iletişim kanalları aracılığıyla elektronik ortamda toplanır."],
      ["Haklarınız (KVKK m.11)", "Verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacını öğrenme, aktarıldığı üçüncü kişileri bilme, düzeltme, silme/yok etme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz."],
      ["Başvuru", `Taleplerinizi info@lumapetshop.com.tr adresine veya ${KEP} KEP adresine ya da ${ADDR} adresine yazılı olarak iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır.`],
    ],
  },
  "mesafeli-satis-sozlesmesi": {
    title: "Mesafeli Satış Sözleşmesi",
    sections: [
      ["1. Taraflar", `SATICI: ${S}\nAdres: ${ADDR}\nTelefon: ${TEL}\nE-posta: info@lumapetshop.com.tr\n${VKN} · ${MERSIS}\n\nALICI: Sipariş sırasında bilgileri girilen müşteri.`],
      ["2. Konu", "Bu sözleşme, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, ALICI'nın internet sitesi üzerinden elektronik ortamda sipariş verdiği ürünlerin satışı ve teslimine ilişkin tarafların hak ve yükümlülüklerini düzenler."],
      ["3. Ürün, Fiyat ve Ödeme", "Ürünlerin cinsi, miktarı, KDV dahil satış fiyatı, kargo ücreti ve ödeme şekli sipariş özetinde ve ALICI'ya gönderilen sipariş onay e-postasında yer alır. Ödeme; kapıda nakit, kapıda kredi kartı veya aktif olduğunda online kart ödemesi ile yapılır."],
      ["4. Teslimat", "Ürünler, ALICI'nın belirttiği adrese en geç 30 gün içinde kargo ile teslim edilir. [ORTALAMA TESLİM SÜRESİ — ör. 1-3 iş günü]. 500 ₺ ve üzeri siparişlerde kargo ücretsizdir; altındaki siparişlerde kargo ücreti sipariş özetinde gösterilir."],
      ["5. Cayma Hakkı", "ALICI, ürünü teslim aldığı tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin cayma hakkını kullanabilir. Cayma bildirimi info@lumapetshop.com.tr adresine yapılır. Bedel, iade ürünün SATICI'ya ulaşmasından itibaren en geç 14 gün içinde ödeme yöntemine uygun şekilde iade edilir."],
      ["6. Cayma Hakkının İstisnaları", "Ambalajı açılmış, kullanılmış veya hijyen açısından iadesi uygun olmayan ürünler (ör. açılmış mama, ödül maması, bakım ürünleri), çabuk bozulabilen veya son kullanma tarihi geçebilecek ürünler Yönetmelik m.15 uyarınca cayma hakkı kapsamı dışındadır."],
      ["7. Uyuşmazlık", "Uyuşmazlıklarda, Ticaret Bakanlığı'nca ilan edilen parasal sınırlar dahilinde ALICI'nın yerleşim yerindeki Tüketici Hakem Heyetleri veya Tüketici Mahkemeleri yetkilidir."],
      ["8. Yürürlük", "ALICI, siparişi onaylamadan önce bu sözleşmeyi ve ön bilgilendirme koşullarını okuduğunu ve kabul ettiğini beyan eder. Sözleşme, siparişin onaylanmasıyla yürürlüğe girer."],
    ],
  },
  "iade-ve-teslimat": {
    title: "İade ve Teslimat Koşulları",
    sections: [
      ["Teslimat", "Siparişler onaylandıktan sonra hazırlanır ve kargoya verilir. Kargoya verildiğinde e-posta ile bilgilendirilir, takip numarasını Siparişlerim sayfasında görebilirsiniz. [ANLAŞMALI KARGO FİRMASI] · [ORTALAMA TESLİM SÜRESİ]"],
      ["Kargo Ücreti", "500 ₺ ve üzeri siparişlerde kargo ücretsizdir. Daha düşük tutarlı siparişlerde 49,90 ₺ kargo ücreti uygulanır."],
      ["Hasarlı Teslimat", "Teslimat sırasında paketi kontrol ediniz; hasarlı paketler için kargo görevlisine tutanak tutturarak teslim almayınız ve bize bildiriniz."],
      ["İade Süreci", "Teslim tarihinden itibaren 14 gün içinde info@lumapetshop.com.tr adresine sipariş numaranızla başvurabilirsiniz. Ürün; kullanılmamış, ambalajı açılmamış ve faturasıyla birlikte gönderilmelidir. [İADE ADRESİ VE ANLAŞMALI İADE KARGO KODU]"],
      ["Para İadesi", "İade ürünü bize ulaştıktan ve kontrol edildikten sonra en geç 14 gün içinde ücret iadesi yapılır. Kapıda ödemeli siparişlerde iade için IBAN bilgisi talep edilir."],
    ],
  },
  "cerez-politikasi": {
    title: "Çerez Politikası",
    sections: [
      ["Çerez Nedir?", "Çerezler, ziyaret ettiğiniz sitenin tarayıcınıza kaydettiği küçük metin dosyalarıdır."],
      ["Kullandığımız Çerezler", "Zorunlu çerezler: oturum açma ve güvenlik (kimlik doğrulama hizmet sağlayıcısı), sepet ve tercihlerinizin hatırlanması. Bu çerezler sitenin çalışması için gereklidir ve KVKK m.5/2 kapsamında işlenir. Şu an reklam veya üçüncü taraf analiz çerezi kullanılmamaktadır."],
      ["Yerel Depolama", "Çerez bildirimi tercihiniz tarayıcınızın yerel depolamasında saklanır."],
      ["Çerezleri Yönetme", "Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz; ancak zorunlu çerezleri engellemeniz durumunda giriş yapma ve sipariş verme işlevleri çalışmayabilir."],
    ],
  },
};

export const LEGAL_LINKS = Object.entries(LEGAL_PAGES).map(([slug, p]) => ({ slug, title: p.title }));
