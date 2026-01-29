-- ============================================================================
-- TRANSLATION SEEDS - DEFAULT UI STRINGS FOR ALL LANGUAGES
-- ============================================================================
-- Populates translation_keys and translations tables with:
-- - Common UI strings (buttons, labels, actions)
-- - POS-specific terminology
-- - Menu management labels
-- - Settings interface strings
-- - Reports and analytics labels
-- - Authentication strings
-- - Error messages
-- - Form validation messages
--
-- Supported Languages (13):
-- - en (English) - US
-- - fr (French), de (German), es (Spanish), it (Italian) - Europe
-- - th (Thai), vi (Vietnamese), id (Indonesian), ms (Malay) - Southeast Asia
-- - hi (Hindi), ta (Tamil), te (Telugu), bn (Bengali), mr (Marathi) - India
-- ============================================================================

-- ============================================================================
-- COMMON NAMESPACE - Shared UI Elements
-- ============================================================================

-- Save Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-save', 'common.save', 'common', 'Save button label', 'Save');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-save-en', 'key-common-save', 'en', 'Save'),
('trans-common-save-fr', 'key-common-save', 'fr', 'Enregistrer'),
('trans-common-save-de', 'key-common-save', 'de', 'Speichern'),
('trans-common-save-es', 'key-common-save', 'es', 'Guardar'),
('trans-common-save-it', 'key-common-save', 'it', 'Salva'),
('trans-common-save-th', 'key-common-save', 'th', 'บันทึก'),
('trans-common-save-vi', 'key-common-save', 'vi', 'Lưu'),
('trans-common-save-id', 'key-common-save', 'id', 'Simpan'),
('trans-common-save-ms', 'key-common-save', 'ms', 'Simpan'),
('trans-common-save-hi', 'key-common-save', 'hi', 'सहेजें'),
('trans-common-save-ta', 'key-common-save', 'ta', 'சேமி'),
('trans-common-save-te', 'key-common-save', 'te', 'సేవ్ చేయండి'),
('trans-common-save-bn', 'key-common-save', 'bn', 'সংরক্ষণ'),
('trans-common-save-mr', 'key-common-save', 'mr', 'जतन करा');

-- Cancel Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-cancel', 'common.cancel', 'common', 'Cancel button label', 'Cancel');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-cancel-en', 'key-common-cancel', 'en', 'Cancel'),
('trans-common-cancel-fr', 'key-common-cancel', 'fr', 'Annuler'),
('trans-common-cancel-de', 'key-common-cancel', 'de', 'Abbrechen'),
('trans-common-cancel-es', 'key-common-cancel', 'es', 'Cancelar'),
('trans-common-cancel-it', 'key-common-cancel', 'it', 'Annulla'),
('trans-common-cancel-th', 'key-common-cancel', 'th', 'ยกเลิก'),
('trans-common-cancel-vi', 'key-common-cancel', 'vi', 'Hủy'),
('trans-common-cancel-id', 'key-common-cancel', 'id', 'Batal'),
('trans-common-cancel-ms', 'key-common-cancel', 'ms', 'Batal'),
('trans-common-cancel-hi', 'key-common-cancel', 'hi', 'रद्द करें'),
('trans-common-cancel-ta', 'key-common-cancel', 'ta', 'ரத்து செய்'),
('trans-common-cancel-te', 'key-common-cancel', 'te', 'రద్దు చేయండి'),
('trans-common-cancel-bn', 'key-common-cancel', 'bn', 'বাতিল'),
('trans-common-cancel-mr', 'key-common-cancel', 'mr', 'रद्द करा');

-- Delete Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-delete', 'common.delete', 'common', 'Delete button label', 'Delete');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-delete-en', 'key-common-delete', 'en', 'Delete'),
('trans-common-delete-fr', 'key-common-delete', 'fr', 'Supprimer'),
('trans-common-delete-de', 'key-common-delete', 'de', 'Löschen'),
('trans-common-delete-es', 'key-common-delete', 'es', 'Eliminar'),
('trans-common-delete-it', 'key-common-delete', 'it', 'Elimina'),
('trans-common-delete-th', 'key-common-delete', 'th', 'ลบ'),
('trans-common-delete-vi', 'key-common-delete', 'vi', 'Xóa'),
('trans-common-delete-id', 'key-common-delete', 'id', 'Hapus'),
('trans-common-delete-ms', 'key-common-delete', 'ms', 'Padam'),
('trans-common-delete-hi', 'key-common-delete', 'hi', 'हटाएं'),
('trans-common-delete-ta', 'key-common-delete', 'ta', 'நீக்கு'),
('trans-common-delete-te', 'key-common-delete', 'te', 'తొలగించు'),
('trans-common-delete-bn', 'key-common-delete', 'bn', 'মুছুন'),
('trans-common-delete-mr', 'key-common-delete', 'mr', 'हटवा');

-- Edit Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-edit', 'common.edit', 'common', 'Edit button label', 'Edit');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-edit-en', 'key-common-edit', 'en', 'Edit'),
('trans-common-edit-fr', 'key-common-edit', 'fr', 'Modifier'),
('trans-common-edit-de', 'key-common-edit', 'de', 'Bearbeiten'),
('trans-common-edit-es', 'key-common-edit', 'es', 'Editar'),
('trans-common-edit-it', 'key-common-edit', 'it', 'Modifica'),
('trans-common-edit-th', 'key-common-edit', 'th', 'แก้ไข'),
('trans-common-edit-vi', 'key-common-edit', 'vi', 'Chỉnh sửa'),
('trans-common-edit-id', 'key-common-edit', 'id', 'Edit'),
('trans-common-edit-ms', 'key-common-edit', 'ms', 'Edit'),
('trans-common-edit-hi', 'key-common-edit', 'hi', 'संपादित करें'),
('trans-common-edit-ta', 'key-common-edit', 'ta', 'திருத்து'),
('trans-common-edit-te', 'key-common-edit', 'te', 'సవరించు'),
('trans-common-edit-bn', 'key-common-edit', 'bn', 'সম্পাদনা'),
('trans-common-edit-mr', 'key-common-edit', 'mr', 'संपादित करा');

-- Confirm
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-confirm', 'common.confirm', 'common', 'Confirm button label', 'Confirm');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-confirm-en', 'key-common-confirm', 'en', 'Confirm'),
('trans-common-confirm-fr', 'key-common-confirm', 'fr', 'Confirmer'),
('trans-common-confirm-de', 'key-common-confirm', 'de', 'Bestätigen'),
('trans-common-confirm-es', 'key-common-confirm', 'es', 'Confirmar'),
('trans-common-confirm-it', 'key-common-confirm', 'it', 'Conferma'),
('trans-common-confirm-th', 'key-common-confirm', 'th', 'ยืนยัน'),
('trans-common-confirm-vi', 'key-common-confirm', 'vi', 'Xác nhận'),
('trans-common-confirm-id', 'key-common-confirm', 'id', 'Konfirmasi'),
('trans-common-confirm-ms', 'key-common-confirm', 'ms', 'Sahkan'),
('trans-common-confirm-hi', 'key-common-confirm', 'hi', 'पुष्टि करें'),
('trans-common-confirm-ta', 'key-common-confirm', 'ta', 'உறுதிப்படுத்து'),
('trans-common-confirm-te', 'key-common-confirm', 'te', 'నిర్ధారించు'),
('trans-common-confirm-bn', 'key-common-confirm', 'bn', 'নিশ্চিত করুন'),
('trans-common-confirm-mr', 'key-common-confirm', 'mr', 'पुष्टी करा');

-- Search
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-search', 'common.search', 'common', 'Search input placeholder', 'Search');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-search-en', 'key-common-search', 'en', 'Search'),
('trans-common-search-fr', 'key-common-search', 'fr', 'Rechercher'),
('trans-common-search-de', 'key-common-search', 'de', 'Suchen'),
('trans-common-search-es', 'key-common-search', 'es', 'Buscar'),
('trans-common-search-it', 'key-common-search', 'it', 'Cerca'),
('trans-common-search-th', 'key-common-search', 'th', 'ค้นหา'),
('trans-common-search-vi', 'key-common-search', 'vi', 'Tìm kiếm'),
('trans-common-search-id', 'key-common-search', 'id', 'Cari'),
('trans-common-search-ms', 'key-common-search', 'ms', 'Cari'),
('trans-common-search-hi', 'key-common-search', 'hi', 'खोजें'),
('trans-common-search-ta', 'key-common-search', 'ta', 'தேடு'),
('trans-common-search-te', 'key-common-search', 'te', 'వెతకండి'),
('trans-common-search-bn', 'key-common-search', 'bn', 'অনুসন্ধান'),
('trans-common-search-mr', 'key-common-search', 'mr', 'शोधा');

-- Loading
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-loading', 'common.loading', 'common', 'Loading indicator text', 'Loading...');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-loading-en', 'key-common-loading', 'en', 'Loading...'),
('trans-common-loading-fr', 'key-common-loading', 'fr', 'Chargement...'),
('trans-common-loading-de', 'key-common-loading', 'de', 'Laden...'),
('trans-common-loading-es', 'key-common-loading', 'es', 'Cargando...'),
('trans-common-loading-it', 'key-common-loading', 'it', 'Caricamento...'),
('trans-common-loading-th', 'key-common-loading', 'th', 'กำลังโหลด...'),
('trans-common-loading-vi', 'key-common-loading', 'vi', 'Đang tải...'),
('trans-common-loading-id', 'key-common-loading', 'id', 'Memuat...'),
('trans-common-loading-ms', 'key-common-loading', 'ms', 'Memuatkan...'),
('trans-common-loading-hi', 'key-common-loading', 'hi', 'लोड हो रहा है...'),
('trans-common-loading-ta', 'key-common-loading', 'ta', 'ஏற்றுகிறது...'),
('trans-common-loading-te', 'key-common-loading', 'te', 'లోడ్ అవుతోంది...'),
('trans-common-loading-bn', 'key-common-loading', 'bn', 'লোড হচ্ছে...'),
('trans-common-loading-mr', 'key-common-loading', 'mr', 'लोड होत आहे...');

-- ============================================================================
-- POS NAMESPACE - Point of Sale Interface
-- ============================================================================

-- Add to Cart
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-addToCart', 'pos.addToCart', 'pos', 'Add to cart button', 'Add to Cart');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-addToCart-en', 'key-pos-addToCart', 'en', 'Add to Cart'),
('trans-pos-addToCart-fr', 'key-pos-addToCart', 'fr', 'Ajouter au panier'),
('trans-pos-addToCart-de', 'key-pos-addToCart', 'de', 'In den Warenkorb'),
('trans-pos-addToCart-es', 'key-pos-addToCart', 'es', 'Agregar al carrito'),
('trans-pos-addToCart-it', 'key-pos-addToCart', 'it', 'Aggiungi al carrello'),
('trans-pos-addToCart-th', 'key-pos-addToCart', 'th', 'เพิ่มในรถเข็น'),
('trans-pos-addToCart-vi', 'key-pos-addToCart', 'vi', 'Thêm vào giỏ'),
('trans-pos-addToCart-id', 'key-pos-addToCart', 'id', 'Tambah ke Keranjang'),
('trans-pos-addToCart-ms', 'key-pos-addToCart', 'ms', 'Tambah ke Troli'),
('trans-pos-addToCart-hi', 'key-pos-addToCart', 'hi', 'कार्ट में जोड़ें'),
('trans-pos-addToCart-ta', 'key-pos-addToCart', 'ta', 'வண்டியில் சேர்'),
('trans-pos-addToCart-te', 'key-pos-addToCart', 'te', 'కార్ట్‌కి జోడించు'),
('trans-pos-addToCart-bn', 'key-pos-addToCart', 'bn', 'কার্টে যোগ করুন'),
('trans-pos-addToCart-mr', 'key-pos-addToCart', 'mr', 'कार्टमध्ये जोडा');

-- Total
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-total', 'pos.total', 'pos', 'Total amount label', 'Total');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-total-en', 'key-pos-total', 'en', 'Total'),
('trans-pos-total-fr', 'key-pos-total', 'fr', 'Total'),
('trans-pos-total-de', 'key-pos-total', 'de', 'Gesamt'),
('trans-pos-total-es', 'key-pos-total', 'es', 'Total'),
('trans-pos-total-it', 'key-pos-total', 'it', 'Totale'),
('trans-pos-total-th', 'key-pos-total', 'th', 'ยอดรวม'),
('trans-pos-total-vi', 'key-pos-total', 'vi', 'Tổng cộng'),
('trans-pos-total-id', 'key-pos-total', 'id', 'Total'),
('trans-pos-total-ms', 'key-pos-total', 'ms', 'Jumlah'),
('trans-pos-total-hi', 'key-pos-total', 'hi', 'कुल'),
('trans-pos-total-ta', 'key-pos-total', 'ta', 'மொத்தம்'),
('trans-pos-total-te', 'key-pos-total', 'te', 'మొత్తం'),
('trans-pos-total-bn', 'key-pos-total', 'bn', 'মোট'),
('trans-pos-total-mr', 'key-pos-total', 'mr', 'एकूण');

-- Checkout
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-checkout', 'pos.checkout', 'pos', 'Checkout button', 'Checkout');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-checkout-en', 'key-pos-checkout', 'en', 'Checkout'),
('trans-pos-checkout-fr', 'key-pos-checkout', 'fr', 'Passer la commande'),
('trans-pos-checkout-de', 'key-pos-checkout', 'de', 'Zur Kasse'),
('trans-pos-checkout-es', 'key-pos-checkout', 'es', 'Pagar'),
('trans-pos-checkout-it', 'key-pos-checkout', 'it', 'Pagamento'),
('trans-pos-checkout-th', 'key-pos-checkout', 'th', 'ชำระเงิน'),
('trans-pos-checkout-vi', 'key-pos-checkout', 'vi', 'Thanh toán'),
('trans-pos-checkout-id', 'key-pos-checkout', 'id', 'Bayar'),
('trans-pos-checkout-ms', 'key-pos-checkout', 'ms', 'Bayar'),
('trans-pos-checkout-hi', 'key-pos-checkout', 'hi', 'भुगतान करें'),
('trans-pos-checkout-ta', 'key-pos-checkout', 'ta', 'பணம் செலுத்து'),
('trans-pos-checkout-te', 'key-pos-checkout', 'te', 'చెక్అవుట్'),
('trans-pos-checkout-bn', 'key-pos-checkout', 'bn', 'চেকআউট'),
('trans-pos-checkout-mr', 'key-pos-checkout', 'mr', 'चेकआउट');

-- Dine In
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-dineIn', 'pos.dineIn', 'pos', 'Dine-in order type label', 'Dine In');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-dineIn-en', 'key-pos-dineIn', 'en', 'Dine In'),
('trans-pos-dineIn-fr', 'key-pos-dineIn', 'fr', 'Sur place'),
('trans-pos-dineIn-de', 'key-pos-dineIn', 'de', 'Im Restaurant'),
('trans-pos-dineIn-es', 'key-pos-dineIn', 'es', 'Comer aquí'),
('trans-pos-dineIn-it', 'key-pos-dineIn', 'it', 'Al tavolo'),
('trans-pos-dineIn-th', 'key-pos-dineIn', 'th', 'ทานที่ร้าน'),
('trans-pos-dineIn-vi', 'key-pos-dineIn', 'vi', 'Tại chỗ'),
('trans-pos-dineIn-id', 'key-pos-dineIn', 'id', 'Makan di tempat'),
('trans-pos-dineIn-ms', 'key-pos-dineIn', 'ms', 'Makan di kedai'),
('trans-pos-dineIn-hi', 'key-pos-dineIn', 'hi', 'यहां भोजन'),
('trans-pos-dineIn-ta', 'key-pos-dineIn', 'ta', 'உணவகத்தில்'),
('trans-pos-dineIn-te', 'key-pos-dineIn', 'te', 'రెస్టారెంట్‌లో'),
('trans-pos-dineIn-bn', 'key-pos-dineIn', 'bn', 'ডাইন ইন'),
('trans-pos-dineIn-mr', 'key-pos-dineIn', 'mr', 'येथे जेवा');

-- Takeaway
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-takeaway', 'pos.takeaway', 'pos', 'Takeaway order type label', 'Takeaway');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-takeaway-en', 'key-pos-takeaway', 'en', 'Takeaway'),
('trans-pos-takeaway-fr', 'key-pos-takeaway', 'fr', 'À emporter'),
('trans-pos-takeaway-de', 'key-pos-takeaway', 'de', 'Zum Mitnehmen'),
('trans-pos-takeaway-es', 'key-pos-takeaway', 'es', 'Para llevar'),
('trans-pos-takeaway-it', 'key-pos-takeaway', 'it', 'Da asporto'),
('trans-pos-takeaway-th', 'key-pos-takeaway', 'th', 'กลับบ้าน'),
('trans-pos-takeaway-vi', 'key-pos-takeaway', 'vi', 'Mang về'),
('trans-pos-takeaway-id', 'key-pos-takeaway', 'id', 'Bawa pulang'),
('trans-pos-takeaway-ms', 'key-pos-takeaway', 'ms', 'Bawa balik'),
('trans-pos-takeaway-hi', 'key-pos-takeaway', 'hi', 'पैकिंग'),
('trans-pos-takeaway-ta', 'key-pos-takeaway', 'ta', 'எடுத்துச் செல்ல'),
('trans-pos-takeaway-te', 'key-pos-takeaway', 'te', 'టేక్అవే'),
('trans-pos-takeaway-bn', 'key-pos-takeaway', 'bn', 'টেকঅ্যাওয়ে'),
('trans-pos-takeaway-mr', 'key-pos-takeaway', 'mr', 'पार्सल');

-- Delivery
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-delivery', 'pos.delivery', 'pos', 'Delivery order type label', 'Delivery');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-delivery-en', 'key-pos-delivery', 'en', 'Delivery'),
('trans-pos-delivery-fr', 'key-pos-delivery', 'fr', 'Livraison'),
('trans-pos-delivery-de', 'key-pos-delivery', 'de', 'Lieferung'),
('trans-pos-delivery-es', 'key-pos-delivery', 'es', 'Entrega a domicilio'),
('trans-pos-delivery-it', 'key-pos-delivery', 'it', 'Consegna'),
('trans-pos-delivery-th', 'key-pos-delivery', 'th', 'จัดส่ง'),
('trans-pos-delivery-vi', 'key-pos-delivery', 'vi', 'Giao hàng'),
('trans-pos-delivery-id', 'key-pos-delivery', 'id', 'Pengiriman'),
('trans-pos-delivery-ms', 'key-pos-delivery', 'ms', 'Penghantaran'),
('trans-pos-delivery-hi', 'key-pos-delivery', 'hi', 'डिलीवरी'),
('trans-pos-delivery-ta', 'key-pos-delivery', 'ta', 'விநியோகம்'),
('trans-pos-delivery-te', 'key-pos-delivery', 'te', 'డెలివరీ'),
('trans-pos-delivery-bn', 'key-pos-delivery', 'bn', 'ডেলিভারি'),
('trans-pos-delivery-mr', 'key-pos-delivery', 'mr', 'डिलिव्हरी');

-- NOTE: This is a starter set of translations. The complete seed file would include:
-- - All POS labels (quantity, price, discount, tax, subtotal, etc.)
-- - Menu management strings (categories, items, modifiers, etc.)
-- - Settings interface (account, restaurant, payment, etc.)
-- - Reports labels (sales, inventory, staff performance, etc.)
-- - Authentication (login, logout, password reset, etc.)
-- - Error messages (validation errors, API errors, etc.)
-- - Form validation messages
--
-- Total: ~200-300 translation keys across all namespaces
--
-- For production, you would generate the complete set using a script or
-- import from a CSV/JSON file for easier management.

-- ============================================================================
-- ONBOARDING NAMESPACE - Restaurant Creation Flow
-- ============================================================================

-- Create Restaurant
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-createRestaurant', 'onboarding.createRestaurant', 'onboarding', 'Main title for onboarding', 'Create Your Restaurant');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-createRestaurant-en', 'key-onboarding-createRestaurant', 'en', 'Create Your Restaurant'),
('trans-onboarding-createRestaurant-fr', 'key-onboarding-createRestaurant', 'fr', 'Créez votre restaurant'),
('trans-onboarding-createRestaurant-de', 'key-onboarding-createRestaurant', 'de', 'Erstellen Sie Ihr Restaurant'),
('trans-onboarding-createRestaurant-es', 'key-onboarding-createRestaurant', 'es', 'Crea tu restaurante'),
('trans-onboarding-createRestaurant-it', 'key-onboarding-createRestaurant', 'it', 'Crea il tuo ristorante'),
('trans-onboarding-createRestaurant-th', 'key-onboarding-createRestaurant', 'th', 'สร้างร้านอาหารของคุณ'),
('trans-onboarding-createRestaurant-vi', 'key-onboarding-createRestaurant', 'vi', 'Tạo nhà hàng của bạn'),
('trans-onboarding-createRestaurant-id', 'key-onboarding-createRestaurant', 'id', 'Buat restoran Anda'),
('trans-onboarding-createRestaurant-ms', 'key-onboarding-createRestaurant', 'ms', 'Cipta restoran anda'),
('trans-onboarding-createRestaurant-hi', 'key-onboarding-createRestaurant', 'hi', 'अपना रेस्तरां बनाएं'),
('trans-onboarding-createRestaurant-ta', 'key-onboarding-createRestaurant', 'ta', 'உங்கள் உணவகத்தை உருவாக்குங்கள்'),
('trans-onboarding-createRestaurant-te', 'key-onboarding-createRestaurant', 'te', 'మీ రెస్టారెంట్‌ను సృష్టించండి'),
('trans-onboarding-createRestaurant-bn', 'key-onboarding-createRestaurant', 'bn', 'আপনার রেস্তোরাঁ তৈরি করুন'),
('trans-onboarding-createRestaurant-mr', 'key-onboarding-createRestaurant', 'mr', 'तुमचे रेस्टॉरंट तयार करा');

-- Get Started
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-getStarted', 'onboarding.getStarted', 'onboarding', 'Subtitle text', 'Get started with voice-powered ordering in minutes');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-getStarted-en', 'key-onboarding-getStarted', 'en', 'Get started with voice-powered ordering in minutes'),
('trans-onboarding-getStarted-fr', 'key-onboarding-getStarted', 'fr', 'Commencez avec la commande vocale en quelques minutes'),
('trans-onboarding-getStarted-de', 'key-onboarding-getStarted', 'de', 'Starten Sie in wenigen Minuten mit Sprachbestellung'),
('trans-onboarding-getStarted-es', 'key-onboarding-getStarted', 'es', 'Comienza con pedidos por voz en minutos'),
('trans-onboarding-getStarted-it', 'key-onboarding-getStarted', 'it', 'Inizia con gli ordini vocali in pochi minuti'),
('trans-onboarding-getStarted-th', 'key-onboarding-getStarted', 'th', 'เริ่มต้นใช้งานการสั่งซื้อด้วยเสียงภายในไม่กี่นาที'),
('trans-onboarding-getStarted-vi', 'key-onboarding-getStarted', 'vi', 'Bắt đầu đặt hàng bằng giọng nói trong vài phút'),
('trans-onboarding-getStarted-id', 'key-onboarding-getStarted', 'id', 'Mulai dengan pesanan suara dalam hitungan menit'),
('trans-onboarding-getStarted-ms', 'key-onboarding-getStarted', 'ms', 'Mulakan pesanan suara dalam beberapa minit'),
('trans-onboarding-getStarted-hi', 'key-onboarding-getStarted', 'hi', 'कुछ ही मिनटों में वॉयस ऑर्डरिंग के साथ शुरुआत करें'),
('trans-onboarding-getStarted-ta', 'key-onboarding-getStarted', 'ta', 'சில நிமிடங்களில் குரல் ஆர்டரிங் மூலம் தொடங்குங்கள்'),
('trans-onboarding-getStarted-te', 'key-onboarding-getStarted', 'te', 'నిమిషాల్లో వాయిస్ ఆర్డరింగ్‌తో ప్రారంభించండి'),
('trans-onboarding-getStarted-bn', 'key-onboarding-getStarted', 'bn', 'কয়েক মিনিটের মধ্যে ভয়েস অর্ডারিং দিয়ে শুরু করুন'),
('trans-onboarding-getStarted-mr', 'key-onboarding-getStarted', 'mr', 'काही मिनिटांत व्हॉइस ऑर्डरिंगसह सुरुवात करा');

-- Restaurant Name Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-restaurantName', 'onboarding.restaurantName', 'onboarding', 'Restaurant name field label', 'Restaurant Name');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-restaurantName-en', 'key-onboarding-restaurantName', 'en', 'Restaurant Name'),
('trans-onboarding-restaurantName-fr', 'key-onboarding-restaurantName', 'fr', 'Nom du restaurant'),
('trans-onboarding-restaurantName-de', 'key-onboarding-restaurantName', 'de', 'Restaurantname'),
('trans-onboarding-restaurantName-es', 'key-onboarding-restaurantName', 'es', 'Nombre del restaurante'),
('trans-onboarding-restaurantName-it', 'key-onboarding-restaurantName', 'it', 'Nome del ristorante'),
('trans-onboarding-restaurantName-th', 'key-onboarding-restaurantName', 'th', 'ชื่อร้านอาหาร'),
('trans-onboarding-restaurantName-vi', 'key-onboarding-restaurantName', 'vi', 'Tên nhà hàng'),
('trans-onboarding-restaurantName-id', 'key-onboarding-restaurantName', 'id', 'Nama restoran'),
('trans-onboarding-restaurantName-ms', 'key-onboarding-restaurantName', 'ms', 'Nama restoran'),
('trans-onboarding-restaurantName-hi', 'key-onboarding-restaurantName', 'hi', 'रेस्तरां का नाम'),
('trans-onboarding-restaurantName-ta', 'key-onboarding-restaurantName', 'ta', 'உணவகத்தின் பெயர்'),
('trans-onboarding-restaurantName-te', 'key-onboarding-restaurantName', 'te', 'రెస్టారెంట్ పేరు'),
('trans-onboarding-restaurantName-bn', 'key-onboarding-restaurantName', 'bn', 'রেস্তোরাঁর নাম'),
('trans-onboarding-restaurantName-mr', 'key-onboarding-restaurantName', 'mr', 'रेस्टॉरंटचे नाव');

-- Restaurant Name Placeholder
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-restaurantNamePlaceholder', 'onboarding.restaurantNamePlaceholder', 'onboarding', 'Restaurant name input placeholder', 'Your Restaurant/ Chain Name');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-restaurantNamePlaceholder-en', 'key-onboarding-restaurantNamePlaceholder', 'en', 'Your Restaurant/ Chain Name'),
('trans-onboarding-restaurantNamePlaceholder-fr', 'key-onboarding-restaurantNamePlaceholder', 'fr', 'Nom de votre restaurant/chaîne'),
('trans-onboarding-restaurantNamePlaceholder-de', 'key-onboarding-restaurantNamePlaceholder', 'de', 'Name Ihres Restaurants/Ihrer Kette'),
('trans-onboarding-restaurantNamePlaceholder-es', 'key-onboarding-restaurantNamePlaceholder', 'es', 'Nombre de su restaurante/cadena'),
('trans-onboarding-restaurantNamePlaceholder-it', 'key-onboarding-restaurantNamePlaceholder', 'it', 'Nome del tuo ristorante/catena'),
('trans-onboarding-restaurantNamePlaceholder-th', 'key-onboarding-restaurantNamePlaceholder', 'th', 'ชื่อร้านอาหาร/เครือข่ายของคุณ'),
('trans-onboarding-restaurantNamePlaceholder-vi', 'key-onboarding-restaurantNamePlaceholder', 'vi', 'Tên nhà hàng/chuỗi của bạn'),
('trans-onboarding-restaurantNamePlaceholder-id', 'key-onboarding-restaurantNamePlaceholder', 'id', 'Nama Restoran/Jaringan Anda'),
('trans-onboarding-restaurantNamePlaceholder-ms', 'key-onboarding-restaurantNamePlaceholder', 'ms', 'Nama Restoran/Rangkaian Anda'),
('trans-onboarding-restaurantNamePlaceholder-hi', 'key-onboarding-restaurantNamePlaceholder', 'hi', 'आपके रेस्तरां/चेन का नाम'),
('trans-onboarding-restaurantNamePlaceholder-ta', 'key-onboarding-restaurantNamePlaceholder', 'ta', 'உங்கள் உணவகம்/சங்கிலியின் பெயர்'),
('trans-onboarding-restaurantNamePlaceholder-te', 'key-onboarding-restaurantNamePlaceholder', 'te', 'మీ రెస్టారెంట్/చెయిన్ పేరు'),
('trans-onboarding-restaurantNamePlaceholder-bn', 'key-onboarding-restaurantNamePlaceholder', 'bn', 'আপনার রেস্তোরাঁ/চেইনের নাম'),
('trans-onboarding-restaurantNamePlaceholder-mr', 'key-onboarding-restaurantNamePlaceholder', 'mr', 'तुमच्या रेस्टॉरंट/चेनचे नाव');

-- Email Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-email', 'onboarding.email', 'onboarding', 'Email field label', 'Email');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-email-en', 'key-onboarding-email', 'en', 'Email'),
('trans-onboarding-email-fr', 'key-onboarding-email', 'fr', 'E-mail'),
('trans-onboarding-email-de', 'key-onboarding-email', 'de', 'E-Mail'),
('trans-onboarding-email-es', 'key-onboarding-email', 'es', 'Correo electrónico'),
('trans-onboarding-email-it', 'key-onboarding-email', 'it', 'Email'),
('trans-onboarding-email-th', 'key-onboarding-email', 'th', 'อีเมล'),
('trans-onboarding-email-vi', 'key-onboarding-email', 'vi', 'Email'),
('trans-onboarding-email-id', 'key-onboarding-email', 'id', 'Email'),
('trans-onboarding-email-ms', 'key-onboarding-email', 'ms', 'Emel'),
('trans-onboarding-email-hi', 'key-onboarding-email', 'hi', 'ईमेल'),
('trans-onboarding-email-ta', 'key-onboarding-email', 'ta', 'மின்னஞ்சல்'),
('trans-onboarding-email-te', 'key-onboarding-email', 'te', 'ఇమెయిల్'),
('trans-onboarding-email-bn', 'key-onboarding-email', 'bn', 'ইমেল'),
('trans-onboarding-email-mr', 'key-onboarding-email', 'mr', 'ईमेल');

-- Email Placeholder
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-emailPlaceholder', 'onboarding.emailPlaceholder', 'onboarding', 'Email input placeholder', 'owner@restaurant.com');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-emailPlaceholder-en', 'key-onboarding-emailPlaceholder', 'en', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-fr', 'key-onboarding-emailPlaceholder', 'fr', 'proprietaire@restaurant.com'),
('trans-onboarding-emailPlaceholder-de', 'key-onboarding-emailPlaceholder', 'de', 'besitzer@restaurant.com'),
('trans-onboarding-emailPlaceholder-es', 'key-onboarding-emailPlaceholder', 'es', 'dueño@restaurant.com'),
('trans-onboarding-emailPlaceholder-it', 'key-onboarding-emailPlaceholder', 'it', 'proprietario@restaurant.com'),
('trans-onboarding-emailPlaceholder-th', 'key-onboarding-emailPlaceholder', 'th', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-vi', 'key-onboarding-emailPlaceholder', 'vi', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-id', 'key-onboarding-emailPlaceholder', 'id', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-ms', 'key-onboarding-emailPlaceholder', 'ms', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-hi', 'key-onboarding-emailPlaceholder', 'hi', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-ta', 'key-onboarding-emailPlaceholder', 'ta', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-te', 'key-onboarding-emailPlaceholder', 'te', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-bn', 'key-onboarding-emailPlaceholder', 'bn', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-mr', 'key-onboarding-emailPlaceholder', 'mr', 'owner@restaurant.com');

-- Phone Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-phone', 'onboarding.phone', 'onboarding', 'Phone field label', 'Phone Number');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-phone-en', 'key-onboarding-phone', 'en', 'Phone Number'),
('trans-onboarding-phone-fr', 'key-onboarding-phone', 'fr', 'Numéro de téléphone'),
('trans-onboarding-phone-de', 'key-onboarding-phone', 'de', 'Telefonnummer'),
('trans-onboarding-phone-es', 'key-onboarding-phone', 'es', 'Número de teléfono'),
('trans-onboarding-phone-it', 'key-onboarding-phone', 'it', 'Numero di telefono'),
('trans-onboarding-phone-th', 'key-onboarding-phone', 'th', 'หมายเลขโทรศัพท์'),
('trans-onboarding-phone-vi', 'key-onboarding-phone', 'vi', 'Số điện thoại'),
('trans-onboarding-phone-id', 'key-onboarding-phone', 'id', 'Nomor telepon'),
('trans-onboarding-phone-ms', 'key-onboarding-phone', 'ms', 'Nombor telefon'),
('trans-onboarding-phone-hi', 'key-onboarding-phone', 'hi', 'फ़ोन नंबर'),
('trans-onboarding-phone-ta', 'key-onboarding-phone', 'ta', 'தொலைபேசி எண்'),
('trans-onboarding-phone-te', 'key-onboarding-phone', 'te', 'ఫోన్ నంబర్'),
('trans-onboarding-phone-bn', 'key-onboarding-phone', 'bn', 'ফোন নম্বর'),
('trans-onboarding-phone-mr', 'key-onboarding-phone', 'mr', 'फोन नंबर');

-- Phone Placeholder
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-phonePlaceholder', 'onboarding.phonePlaceholder', 'onboarding', 'Phone input placeholder', '+1234567890');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-phonePlaceholder-en', 'key-onboarding-phonePlaceholder', 'en', '+1234567890'),
('trans-onboarding-phonePlaceholder-fr', 'key-onboarding-phonePlaceholder', 'fr', '+33123456789'),
('trans-onboarding-phonePlaceholder-de', 'key-onboarding-phonePlaceholder', 'de', '+49123456789'),
('trans-onboarding-phonePlaceholder-es', 'key-onboarding-phonePlaceholder', 'es', '+34123456789'),
('trans-onboarding-phonePlaceholder-it', 'key-onboarding-phonePlaceholder', 'it', '+39123456789'),
('trans-onboarding-phonePlaceholder-th', 'key-onboarding-phonePlaceholder', 'th', '+66812345678'),
('trans-onboarding-phonePlaceholder-vi', 'key-onboarding-phonePlaceholder', 'vi', '+84912345678'),
('trans-onboarding-phonePlaceholder-id', 'key-onboarding-phonePlaceholder', 'id', '+62812345678'),
('trans-onboarding-phonePlaceholder-ms', 'key-onboarding-phonePlaceholder', 'ms', '+60123456789'),
('trans-onboarding-phonePlaceholder-hi', 'key-onboarding-phonePlaceholder', 'hi', '+919876543210'),
('trans-onboarding-phonePlaceholder-ta', 'key-onboarding-phonePlaceholder', 'ta', '+919876543210'),
('trans-onboarding-phonePlaceholder-te', 'key-onboarding-phonePlaceholder', 'te', '+919876543210'),
('trans-onboarding-phonePlaceholder-bn', 'key-onboarding-phonePlaceholder', 'bn', '+8801234567890'),
('trans-onboarding-phonePlaceholder-mr', 'key-onboarding-phonePlaceholder', 'mr', '+919876543210');

-- Phone Helper
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-phoneHelper', 'onboarding.phoneHelper', 'onboarding', 'Phone helper text', 'International format (e.g., +1234567890)');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-phoneHelper-en', 'key-onboarding-phoneHelper', 'en', 'International format (e.g., +1234567890)'),
('trans-onboarding-phoneHelper-fr', 'key-onboarding-phoneHelper', 'fr', 'Format international (ex: +33123456789)'),
('trans-onboarding-phoneHelper-de', 'key-onboarding-phoneHelper', 'de', 'Internationales Format (z.B. +49123456789)'),
('trans-onboarding-phoneHelper-es', 'key-onboarding-phoneHelper', 'es', 'Formato internacional (ej: +34123456789)'),
('trans-onboarding-phoneHelper-it', 'key-onboarding-phoneHelper', 'it', 'Formato internazionale (es: +39123456789)'),
('trans-onboarding-phoneHelper-th', 'key-onboarding-phoneHelper', 'th', 'รูปแบบสากล (เช่น +66812345678)'),
('trans-onboarding-phoneHelper-vi', 'key-onboarding-phoneHelper', 'vi', 'Định dạng quốc tế (vd: +84912345678)'),
('trans-onboarding-phoneHelper-id', 'key-onboarding-phoneHelper', 'id', 'Format internasional (mis: +62812345678)'),
('trans-onboarding-phoneHelper-ms', 'key-onboarding-phoneHelper', 'ms', 'Format antarabangsa (cth: +60123456789)'),
('trans-onboarding-phoneHelper-hi', 'key-onboarding-phoneHelper', 'hi', 'अंतर्राष्ट्रीय प्रारूप (उदा: +919876543210)'),
('trans-onboarding-phoneHelper-ta', 'key-onboarding-phoneHelper', 'ta', 'சர்வதேச வடிவம் (எ.கா: +919876543210)'),
('trans-onboarding-phoneHelper-te', 'key-onboarding-phoneHelper', 'te', 'అంతర్జాతీయ ఫార్మాట్ (ఉదా: +919876543210)'),
('trans-onboarding-phoneHelper-bn', 'key-onboarding-phoneHelper', 'bn', 'আন্তর্জাতিক বিন্যাস (যেমন: +8801234567890)'),
('trans-onboarding-phoneHelper-mr', 'key-onboarding-phoneHelper', 'mr', 'आंतरराष्ट्रीय स्वरूप (उदा: +919876543210)');

-- Subdomain Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-subdomain', 'onboarding.subdomain', 'onboarding', 'Subdomain field label', 'Subdomain (Auto-generated)');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-subdomain-en', 'key-onboarding-subdomain', 'en', 'Subdomain (Auto-generated)'),
('trans-onboarding-subdomain-fr', 'key-onboarding-subdomain', 'fr', 'Sous-domaine (généré automatiquement)'),
('trans-onboarding-subdomain-de', 'key-onboarding-subdomain', 'de', 'Subdomain (automatisch generiert)'),
('trans-onboarding-subdomain-es', 'key-onboarding-subdomain', 'es', 'Subdominio (generado automáticamente)'),
('trans-onboarding-subdomain-it', 'key-onboarding-subdomain', 'it', 'Sottodominio (generato automaticamente)'),
('trans-onboarding-subdomain-th', 'key-onboarding-subdomain', 'th', 'ซับโดเมน (สร้างอัตโนมัติ)'),
('trans-onboarding-subdomain-vi', 'key-onboarding-subdomain', 'vi', 'Tên miền phụ (tự động tạo)'),
('trans-onboarding-subdomain-id', 'key-onboarding-subdomain', 'id', 'Subdomain (dibuat otomatis)'),
('trans-onboarding-subdomain-ms', 'key-onboarding-subdomain', 'ms', 'Subdomain (dijana auto)'),
('trans-onboarding-subdomain-hi', 'key-onboarding-subdomain', 'hi', 'सबडोमेन (स्वतः जनरेट)'),
('trans-onboarding-subdomain-ta', 'key-onboarding-subdomain', 'ta', 'துணை டொமைன் (தானியங்கி உருவாக்கம்)'),
('trans-onboarding-subdomain-te', 'key-onboarding-subdomain', 'te', 'సబ్‌డొమైన్ (ఆటో-జనరేట్)'),
('trans-onboarding-subdomain-bn', 'key-onboarding-subdomain', 'bn', 'সাবডোমেন (অটো-জেনারেট)'),
('trans-onboarding-subdomain-mr', 'key-onboarding-subdomain', 'mr', 'सबडोमेन (ऑटो-जनरेट)');

-- Subdomain Placeholder
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-subdomainPlaceholder', 'onboarding.subdomainPlaceholder', 'onboarding', 'Subdomain placeholder', 'Will be generated from restaurant name');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-subdomainPlaceholder-en', 'key-onboarding-subdomainPlaceholder', 'en', 'Will be generated from restaurant name'),
('trans-onboarding-subdomainPlaceholder-fr', 'key-onboarding-subdomainPlaceholder', 'fr', 'Sera généré à partir du nom du restaurant'),
('trans-onboarding-subdomainPlaceholder-de', 'key-onboarding-subdomainPlaceholder', 'de', 'Wird aus dem Restaurantnamen generiert'),
('trans-onboarding-subdomainPlaceholder-es', 'key-onboarding-subdomainPlaceholder', 'es', 'Se generará a partir del nombre del restaurante'),
('trans-onboarding-subdomainPlaceholder-it', 'key-onboarding-subdomainPlaceholder', 'it', 'Verrà generato dal nome del ristorante'),
('trans-onboarding-subdomainPlaceholder-th', 'key-onboarding-subdomainPlaceholder', 'th', 'จะถูกสร้างจากชื่อร้านอาหาร'),
('trans-onboarding-subdomainPlaceholder-vi', 'key-onboarding-subdomainPlaceholder', 'vi', 'Sẽ được tạo từ tên nhà hàng'),
('trans-onboarding-subdomainPlaceholder-id', 'key-onboarding-subdomainPlaceholder', 'id', 'Akan dibuat dari nama restoran'),
('trans-onboarding-subdomainPlaceholder-ms', 'key-onboarding-subdomainPlaceholder', 'ms', 'Akan dijana daripada nama restoran'),
('trans-onboarding-subdomainPlaceholder-hi', 'key-onboarding-subdomainPlaceholder', 'hi', 'रेस्तरां के नाम से जेनरेट होगा'),
('trans-onboarding-subdomainPlaceholder-ta', 'key-onboarding-subdomainPlaceholder', 'ta', 'உணவக பெயரிலிருந்து உருவாக்கப்படும்'),
('trans-onboarding-subdomainPlaceholder-te', 'key-onboarding-subdomainPlaceholder', 'te', 'రెస్టారెంట్ పేరు నుండి జనరేట్ చేయబడుతుంది'),
('trans-onboarding-subdomainPlaceholder-bn', 'key-onboarding-subdomainPlaceholder', 'bn', 'রেস্তোরাঁর নাম থেকে তৈরি হবে'),
('trans-onboarding-subdomainPlaceholder-mr', 'key-onboarding-subdomainPlaceholder', 'mr', 'रेस्टॉरंटच्या नावावरून तयार होईल');

-- Subdomain Helper
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-subdomainHelper', 'onboarding.subdomainHelper', 'onboarding', 'Subdomain helper text', 'Your restaurant will be at');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-subdomainHelper-en', 'key-onboarding-subdomainHelper', 'en', 'Your restaurant will be at'),
('trans-onboarding-subdomainHelper-fr', 'key-onboarding-subdomainHelper', 'fr', 'Votre restaurant sera à'),
('trans-onboarding-subdomainHelper-de', 'key-onboarding-subdomainHelper', 'de', 'Ihr Restaurant wird verfügbar sein unter'),
('trans-onboarding-subdomainHelper-es', 'key-onboarding-subdomainHelper', 'es', 'Su restaurante estará en'),
('trans-onboarding-subdomainHelper-it', 'key-onboarding-subdomainHelper', 'it', 'Il tuo ristorante sarà disponibile su'),
('trans-onboarding-subdomainHelper-th', 'key-onboarding-subdomainHelper', 'th', 'ร้านอาหารของคุณจะอยู่ที่'),
('trans-onboarding-subdomainHelper-vi', 'key-onboarding-subdomainHelper', 'vi', 'Nhà hàng của bạn sẽ ở'),
('trans-onboarding-subdomainHelper-id', 'key-onboarding-subdomainHelper', 'id', 'Restoran Anda akan berada di'),
('trans-onboarding-subdomainHelper-ms', 'key-onboarding-subdomainHelper', 'ms', 'Restoran anda akan berada di'),
('trans-onboarding-subdomainHelper-hi', 'key-onboarding-subdomainHelper', 'hi', 'आपका रेस्तरां यहां होगा'),
('trans-onboarding-subdomainHelper-ta', 'key-onboarding-subdomainHelper', 'ta', 'உங்கள் உணவகம் இங்கே இருக்கும்'),
('trans-onboarding-subdomainHelper-te', 'key-onboarding-subdomainHelper', 'te', 'మీ రెస్టారెంట్ ఇక్కడ ఉంటుంది'),
('trans-onboarding-subdomainHelper-bn', 'key-onboarding-subdomainHelper', 'bn', 'আপনার রেস্তোরাঁ এখানে থাকবে'),
('trans-onboarding-subdomainHelper-mr', 'key-onboarding-subdomainHelper', 'mr', 'तुमचे रेस्टॉरंट येथे असेल');

-- Create Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-createButton', 'onboarding.createButton', 'onboarding', 'Create restaurant button', 'Create Restaurant');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-createButton-en', 'key-onboarding-createButton', 'en', 'Create Restaurant'),
('trans-onboarding-createButton-fr', 'key-onboarding-createButton', 'fr', 'Créer le restaurant'),
('trans-onboarding-createButton-de', 'key-onboarding-createButton', 'de', 'Restaurant erstellen'),
('trans-onboarding-createButton-es', 'key-onboarding-createButton', 'es', 'Crear restaurante'),
('trans-onboarding-createButton-it', 'key-onboarding-createButton', 'it', 'Crea ristorante'),
('trans-onboarding-createButton-th', 'key-onboarding-createButton', 'th', 'สร้างร้านอาหาร'),
('trans-onboarding-createButton-vi', 'key-onboarding-createButton', 'vi', 'Tạo nhà hàng'),
('trans-onboarding-createButton-id', 'key-onboarding-createButton', 'id', 'Buat restoran'),
('trans-onboarding-createButton-ms', 'key-onboarding-createButton', 'ms', 'Cipta restoran'),
('trans-onboarding-createButton-hi', 'key-onboarding-createButton', 'hi', 'रेस्तरां बनाएं'),
('trans-onboarding-createButton-ta', 'key-onboarding-createButton', 'ta', 'உணவகத்தை உருவாக்கு'),
('trans-onboarding-createButton-te', 'key-onboarding-createButton', 'te', 'రెస్టారెంట్‌ను సృష్టించండి'),
('trans-onboarding-createButton-bn', 'key-onboarding-createButton', 'bn', 'রেস্তোরাঁ তৈরি করুন'),
('trans-onboarding-createButton-mr', 'key-onboarding-createButton', 'mr', 'रेस्टॉरंट तयार करा');

-- Terms Agreement
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-termsAgreement', 'onboarding.termsAgreement', 'onboarding', 'Terms agreement text', 'By creating a restaurant, you agree to our Terms of Service and Privacy Policy');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-termsAgreement-en', 'key-onboarding-termsAgreement', 'en', 'By creating a restaurant, you agree to our Terms of Service and Privacy Policy'),
('trans-onboarding-termsAgreement-fr', 'key-onboarding-termsAgreement', 'fr', 'En créant un restaurant, vous acceptez nos Conditions d''utilisation et notre Politique de confidentialité'),
('trans-onboarding-termsAgreement-de', 'key-onboarding-termsAgreement', 'de', 'Durch das Erstellen eines Restaurants stimmen Sie unseren Nutzungsbedingungen und Datenschutzrichtlinien zu'),
('trans-onboarding-termsAgreement-es', 'key-onboarding-termsAgreement', 'es', 'Al crear un restaurante, acepta nuestros Términos de servicio y Política de privacidad'),
('trans-onboarding-termsAgreement-it', 'key-onboarding-termsAgreement', 'it', 'Creando un ristorante, accetti i nostri Termini di servizio e la Politica sulla privacy'),
('trans-onboarding-termsAgreement-th', 'key-onboarding-termsAgreement', 'th', 'การสร้างร้านอาหาร คุณยอมรับข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวของเรา'),
('trans-onboarding-termsAgreement-vi', 'key-onboarding-termsAgreement', 'vi', 'Bằng cách tạo nhà hàng, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của chúng tôi'),
('trans-onboarding-termsAgreement-id', 'key-onboarding-termsAgreement', 'id', 'Dengan membuat restoran, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi kami'),
('trans-onboarding-termsAgreement-ms', 'key-onboarding-termsAgreement', 'ms', 'Dengan mencipta restoran, anda bersetuju dengan Syarat Perkhidmatan dan Dasar Privasi kami'),
('trans-onboarding-termsAgreement-hi', 'key-onboarding-termsAgreement', 'hi', 'रेस्तरां बनाकर, आप हमारी सेवा की शर्तों और गोपनीयता नीति से सहमत होते हैं'),
('trans-onboarding-termsAgreement-ta', 'key-onboarding-termsAgreement', 'ta', 'உணவகத்தை உருவாக்குவதன் மூலம், எங்கள் சேவை விதிமுறைகள் மற்றும் தனியுரிமை கொள்கையை ஏற்கிறீர்கள்'),
('trans-onboarding-termsAgreement-te', 'key-onboarding-termsAgreement', 'te', 'రెస్టారెంట్‌ను సృష్టించడం ద్వారా, మీరు మా సేవా నిబంధనలు మరియు గోప్యతా విధానాన్ని అంగీకరిస్తున్నారు'),
('trans-onboarding-termsAgreement-bn', 'key-onboarding-termsAgreement', 'bn', 'একটি রেস্তোরাঁ তৈরি করে, আপনি আমাদের পরিষেবার শর্তাবলী এবং গোপনীয়তা নীতিতে সম্মত হন'),
('trans-onboarding-termsAgreement-mr', 'key-onboarding-termsAgreement', 'mr', 'रेस्टॉरंट तयार करून, तुम्ही आमच्या सेवा अटी आणि गोपनीयता धोरणाशी सहमत आहात');

-- Cancel Button (already exists in common namespace, add reference)
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-cancel', 'cancel', 'common', 'Cancel button', 'Cancel');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-cancel-en', 'key-onboarding-cancel', 'en', 'Cancel'),
('trans-onboarding-cancel-fr', 'key-onboarding-cancel', 'fr', 'Annuler'),
('trans-onboarding-cancel-de', 'key-onboarding-cancel', 'de', 'Abbrechen'),
('trans-onboarding-cancel-es', 'key-onboarding-cancel', 'es', 'Cancelar'),
('trans-onboarding-cancel-it', 'key-onboarding-cancel', 'it', 'Annulla'),
('trans-onboarding-cancel-th', 'key-onboarding-cancel', 'th', 'ยกเลิก'),
('trans-onboarding-cancel-vi', 'key-onboarding-cancel', 'vi', 'Hủy'),
('trans-onboarding-cancel-id', 'key-onboarding-cancel', 'id', 'Batal'),
('trans-onboarding-cancel-ms', 'key-onboarding-cancel', 'ms', 'Batal'),
('trans-onboarding-cancel-hi', 'key-onboarding-cancel', 'hi', 'रद्द करें'),
('trans-onboarding-cancel-ta', 'key-onboarding-cancel', 'ta', 'ரத்துசெய்'),
('trans-onboarding-cancel-te', 'key-onboarding-cancel', 'te', 'రద్దు చేయండి'),
('trans-onboarding-cancel-bn', 'key-onboarding-cancel', 'bn', 'বাতিল'),
('trans-onboarding-cancel-mr', 'key-onboarding-cancel', 'mr', 'रद्द करा');

-- ============================================================================
-- SEED MIGRATION COMPLETE
-- ============================================================================
