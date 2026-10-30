U = "https://images.unsplash.com/"
Q = "?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"

SEED_PRODUCTS = [
    ("Premium Somonlu Yetişkin Kedi Maması 15kg", "kedi", 849.90, 999.90, "photo-1655210913315-e8147faf7600", 4.9, True, 40,
     "Somon ve pirinç içeren, tüy sağlığını destekleyen tahılsız yetişkin kedi maması."),
    ("Tavuklu ve Pirinçli Köpek Maması 12kg", "kopek", 929.00, 1150.00, "photo-1563460716037-460a3ad24ba9", 4.8, True, 35,
     "Orta ve büyük ırk yetişkin köpekler için yüksek proteinli tavuklu mama."),
    ("Renkli Muhabbet Kuşu Yemi ve Vitamin Seti", "kus", 149.50, 189.00, "photo-1714335407781-67d459552736", 4.7, True, 60,
     "Tohum karışımı ve sıvı vitamin destekli muhabbet kuşu bakım seti."),
    ("Akvaryum İç Filtre & LED Aydınlatma Seti", "balik", 450.00, 520.00, "photo-1579967327980-2a4117da0e4a", 4.6, True, 20,
     "60-100 litre akvaryumlar için sessiz iç filtre ve renkli LED aydınlatma."),
    ("Dayanıklı Kauçuk Köpek Oyun Topu", "kopek", 129.90, None, "photo-1612502169027-5a379283f9c0", 4.7, False, 80,
     "Çiğnemeye dayanıklı, suda yüzen doğal kauçuk oyun topu."),
    ("Kaktüs Tasarımlı Kedi Tırmalama Tahtası", "kedi", 389.00, 459.00, "photo-1601758065893-25c11bfa69b5", 4.8, True, 25,
     "Sisal ip kaplı, sağlam tabanlı dekoratif tırmalama tahtası."),
    ("Kulübeli Kedi Tırmalama Kulesi", "kedi", 1249.00, 1499.00, "photo-1636543459759-44c65688e8fb", 4.9, False, 10,
     "Çadır yataklı, asılı oyuncaklı çok katlı kedi oyun kulesi."),
    ("Köpek Eğitim Seti (Top + İp)", "kopek", 199.00, 249.00, "photo-1586875331842-5409a287612d", 4.5, False, 50,
     "Getir-götür oyunları için fırlatma topu ve pamuk çekiştirme ipi."),
    ("Hamster Talaşı Doğal Yatak Malzemesi 5L", "kemirgen", 89.90, None, "photo-1657398756153-fdcf62327b1c", 4.6, False, 100,
     "Tozsuz, emici ve kokusuz doğal ağaç talaşı."),
    ("Egzersiz Çarklı Hamster Kafesi", "kemirgen", 699.00, 799.00, "photo-1657399621130-67f3e1bd8da7", 4.7, True, 15,
     "Sessiz egzersiz çarkı, su kabı ve yemlik dahil iki katlı kafes."),
    ("Tropikal Balık Pul Yemi 250ml", "balik", 99.00, None, "photo-1520301255226-bf5f144451c1", 4.5, False, 90,
     "Tüm tropikal balıklar için renk canlandırıcı vitaminli pul yem."),
    ("Kanarya & Papağan Oyun Salıncağı", "kus", 119.00, 139.00, "photo-1714335407781-67d459552736", 4.4, False, 45,
     "Doğal ahşap ve renkli boncuklu kafes içi salıncak."),
]


def seed_rows():
    return [
        dict(name=n, category=c, price=p, original_price=o, image_url=f"{U}{img}{Q}", rating=r,
             is_featured=f, stock=s, description=d)
        for n, c, p, o, img, r, f, s, d in SEED_PRODUCTS
    ]
