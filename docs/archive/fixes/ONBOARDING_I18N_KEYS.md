# Onboarding Translation Keys

## Overview

The SimpleRestaurantOnboarding component has been made multilingual. Users can now select their language from a dropdown, and all UI elements will update accordingly.

## Changes Made

### 1. Added Language Selector
- Dropdown at the top-right of the onboarding form
- Shows all 13 supported languages in their native script
- Instantly updates all UI text when changed

### 2. Translated UI Elements
All hardcoded English strings have been replaced with translation keys:

| UI Element | Translation Key | English Default |
|------------|----------------|-----------------|
| **Title** | `onboarding.createRestaurant` | Create Your Restaurant |
| **Subtitle** | `onboarding.getStarted` | Get started with HandsFree POS in minutes |
| **Form Labels** |
| Restaurant Name | `onboarding.restaurantName` | Restaurant Name |
| Email | `onboarding.email` | Email |
| Phone | `onboarding.phone` | Phone Number |
| Subdomain | `onboarding.subdomain` | Subdomain (Auto-generated) |
| **Placeholders** |
| Restaurant Name | `onboarding.restaurantNamePlaceholder` | Your Restaurant/ Chain Name |
| Email | `onboarding.emailPlaceholder` | owner@restaurant.com |
| Phone | `onboarding.phonePlaceholder` | +91 98765 43210 |
| Subdomain | `onboarding.subdomainPlaceholder` | Will be generated from restaurant name |
| **Buttons** |
| Cancel | `cancel` | Cancel |
| Create | `onboarding.createButton` | Create Restaurant |
| **Helper Text** |
| Subdomain Info | `onboarding.subdomainHelper` | Your restaurant will be at |
| Terms | `onboarding.termsAgreement` | By creating a restaurant, you agree to our Terms of Service |

---

## SQL to Add to Seed Migration

Add these to `src-tauri/migrations/022_seed_translations.sql`:

```sql
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
VALUES ('key-onboarding-getStarted', 'onboarding.getStarted', 'onboarding', 'Subtitle text', 'Get started with HandsFree POS in minutes');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-getStarted-en', 'key-onboarding-getStarted', 'en', 'Get started with HandsFree POS in minutes'),
('trans-onboarding-getStarted-fr', 'key-onboarding-getStarted', 'fr', 'Commencez avec HandsFree POS en quelques minutes'),
('trans-onboarding-getStarted-de', 'key-onboarding-getStarted', 'de', 'Starten Sie in wenigen Minuten mit HandsFree POS'),
('trans-onboarding-getStarted-es', 'key-onboarding-getStarted', 'es', 'Comienza con HandsFree POS en minutos'),
('trans-onboarding-getStarted-it', 'key-onboarding-getStarted', 'it', 'Inizia con HandsFree POS in pochi minuti'),
('trans-onboarding-getStarted-th', 'key-onboarding-getStarted', 'th', 'เริ่มต้นใช้งาน HandsFree POS ภายในไม่กี่นาที'),
('trans-onboarding-getStarted-vi', 'key-onboarding-getStarted', 'vi', 'Bắt đầu với HandsFree POS trong vài phút'),
('trans-onboarding-getStarted-id', 'key-onboarding-getStarted', 'id', 'Mulai dengan HandsFree POS dalam hitungan menit'),
('trans-onboarding-getStarted-ms', 'key-onboarding-getStarted', 'ms', 'Mulakan dengan HandsFree POS dalam beberapa minit'),
('trans-onboarding-getStarted-hi', 'key-onboarding-getStarted', 'hi', 'कुछ ही मिनटों में HandsFree POS के साथ शुरुआत करें'),
('trans-onboarding-getStarted-ta', 'key-onboarding-getStarted', 'ta', 'சில நிமிடங்களில் HandsFree POS உடன் தொடங்குங்கள்'),
('trans-onboarding-getStarted-te', 'key-onboarding-getStarted', 'te', 'నిమిషాల్లో HandsFree POS తో ప్రారంభించండి'),
('trans-onboarding-getStarted-bn', 'key-onboarding-getStarted', 'bn', 'কয়েক মিনিটের মধ্যে HandsFree POS দিয়ে শুরু করুন'),
('trans-onboarding-getStarted-mr', 'key-onboarding-getStarted', 'mr', 'काही मिनिटांत HandsFree POS सह सुरुवात करा');

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

-- Add remaining keys for subdomain, placeholders, helper text, and terms...
-- (See pattern above and continue for all keys listed in the table)
```

---

## Usage

The component automatically:
1. Loads user's current language preference (or defaults to browser language)
2. Displays all text in that language
3. Provides a dropdown to switch languages instantly
4. Falls back to English if a translation is missing

## Example

When user selects **Hindi (हिंदी)**:
- Title becomes: "अपना रेस्तरां बनाएं"
- Email label: "ईमेल"
- Create button: "रेस्तरां बनाएं"

## Testing

To test:
1. Build app with migrations: `bun tauri dev`
2. Navigate to onboarding flow
3. Click language dropdown (top-right)
4. Select different language
5. Verify all UI elements update

---

## Provisioning Flow Translation Keys (StoreCreationModal)

The StoreCreationModal component (provisioning flow) has also been made multilingual.

### Translation Keys Required

| UI Element | Translation Key | English Default |
|------------|----------------|-----------------|
| **Step Labels** |
| Validate | `provisioning.validateStep` | Validating restaurant information |
| Provision | `provisioning.provisionStep` | Provisioning infrastructure (DNS, KV, D1, R2) |
| Worker | `provisioning.workerStep` | Deploying tenant worker |
| Activation | `provisioning.activationStep` | Generating activation code |
| Finalize | `provisioning.finalizeStep` | Finalizing restaurant setup |
| **Headers** |
| Creating | `provisioning.creating` | Creating Restaurant |
| Completed | `provisioning.completed` | Restaurant Created! |
| Failed | `provisioning.failed` | Creation Failed |
| **Messages** |
| Please Wait | `provisioning.pleaseWait` | Please wait while we set up your infrastructure |
| Ready | `provisioning.readyMessage` | Your restaurant is ready to activate |
| Error | `provisioning.errorMessage` | An error occurred during provisioning |
| **Status** |
| Completed In | `provisioning.completedIn` | Completed in {{seconds}}s |
| **Activation Code** |
| Label | `provisioning.activationCode` | Activation Code |
| Copy | `provisioning.copyToClipboard` | Copy to clipboard |
| Save Message | `provisioning.saveCodeMessage` | Save this code - you'll need it to activate your POS system |
| **Buttons** |
| Continue | `provisioning.continueButton` | Continue to Activation |

### SQL for Provisioning Keys

Add these to `src-tauri/migrations/022_seed_translations.sql`:

```sql
-- ============================================================================
-- PROVISIONING NAMESPACE - Restaurant Creation Progress
-- ============================================================================

-- Validate Step
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-validateStep', 'provisioning.validateStep', 'provisioning', 'Validation step label', 'Validating restaurant information');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-validateStep-en', 'key-provisioning-validateStep', 'en', 'Validating restaurant information'),
('trans-provisioning-validateStep-fr', 'key-provisioning-validateStep', 'fr', 'Validation des informations du restaurant'),
('trans-provisioning-validateStep-de', 'key-provisioning-validateStep', 'de', 'Restaurantinformationen werden validiert'),
('trans-provisioning-validateStep-es', 'key-provisioning-validateStep', 'es', 'Validando información del restaurante'),
('trans-provisioning-validateStep-it', 'key-provisioning-validateStep', 'it', 'Validazione informazioni ristorante'),
('trans-provisioning-validateStep-th', 'key-provisioning-validateStep', 'th', 'กำลังตรวจสอบข้อมูลร้านอาหาร'),
('trans-provisioning-validateStep-vi', 'key-provisioning-validateStep', 'vi', 'Đang xác thực thông tin nhà hàng'),
('trans-provisioning-validateStep-id', 'key-provisioning-validateStep', 'id', 'Memvalidasi informasi restoran'),
('trans-provisioning-validateStep-ms', 'key-provisioning-validateStep', 'ms', 'Mengesahkan maklumat restoran'),
('trans-provisioning-validateStep-hi', 'key-provisioning-validateStep', 'hi', 'रेस्तरां की जानकारी सत्यापित की जा रही है'),
('trans-provisioning-validateStep-ta', 'key-provisioning-validateStep', 'ta', 'உணவக தகவல் சரிபார்க்கப்படுகிறது'),
('trans-provisioning-validateStep-te', 'key-provisioning-validateStep', 'te', 'రెస్టారెంట్ సమాచారాన్ని ధృవీకరిస్తోంది'),
('trans-provisioning-validateStep-bn', 'key-provisioning-validateStep', 'bn', 'রেস্তোরাঁর তথ্য যাচাই করা হচ্ছে'),
('trans-provisioning-validateStep-mr', 'key-provisioning-validateStep', 'mr', 'रेस्टॉरंटची माहिती प्रमाणित केली जात आहे');

-- Provision Step
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-provisionStep', 'provisioning.provisionStep', 'provisioning', 'Infrastructure provisioning label', 'Provisioning infrastructure (DNS, KV, D1, R2)');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-provisionStep-en', 'key-provisioning-provisionStep', 'en', 'Provisioning infrastructure (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-fr', 'key-provisioning-provisionStep', 'fr', 'Provisionnement de l''infrastructure (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-de', 'key-provisioning-provisionStep', 'de', 'Infrastruktur wird bereitgestellt (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-es', 'key-provisioning-provisionStep', 'es', 'Aprovisionando infraestructura (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-it', 'key-provisioning-provisionStep', 'it', 'Provisioning infrastruttura (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-th', 'key-provisioning-provisionStep', 'th', 'กำลังจัดเตรียมโครงสร้างพื้นฐาน (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-vi', 'key-provisioning-provisionStep', 'vi', 'Đang cung cấp hạ tầng (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-id', 'key-provisioning-provisionStep', 'id', 'Menyediakan infrastruktur (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-ms', 'key-provisioning-provisionStep', 'ms', 'Menyediakan infrastruktur (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-hi', 'key-provisioning-provisionStep', 'hi', 'बुनियादी ढांचा प्रावधान (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-ta', 'key-provisioning-provisionStep', 'ta', 'உள்கட்டமைப்பு வழங்குதல் (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-te', 'key-provisioning-provisionStep', 'te', 'మౌలిక సదుపాయాలను అందిస్తోంది (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-bn', 'key-provisioning-provisionStep', 'bn', 'অবকাঠামো প্রদান করা হচ্ছে (DNS, KV, D1, R2)'),
('trans-provisioning-provisionStep-mr', 'key-provisioning-provisionStep', 'mr', 'पायाभूत सुविधा तरतूद (DNS, KV, D1, R2)');

-- Worker Step
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-workerStep', 'provisioning.workerStep', 'provisioning', 'Worker deployment label', 'Deploying tenant worker');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-workerStep-en', 'key-provisioning-workerStep', 'en', 'Deploying tenant worker'),
('trans-provisioning-workerStep-fr', 'key-provisioning-workerStep', 'fr', 'Déploiement du worker locataire'),
('trans-provisioning-workerStep-de', 'key-provisioning-workerStep', 'de', 'Tenant-Worker wird bereitgestellt'),
('trans-provisioning-workerStep-es', 'key-provisioning-workerStep', 'es', 'Desplegando worker del inquilino'),
('trans-provisioning-workerStep-it', 'key-provisioning-workerStep', 'it', 'Distribuzione worker tenant'),
('trans-provisioning-workerStep-th', 'key-provisioning-workerStep', 'th', 'กำลังปรับใช้เวิร์กเกอร์เทนันต์'),
('trans-provisioning-workerStep-vi', 'key-provisioning-workerStep', 'vi', 'Đang triển khai worker tenant'),
('trans-provisioning-workerStep-id', 'key-provisioning-workerStep', 'id', 'Menerapkan worker tenant'),
('trans-provisioning-workerStep-ms', 'key-provisioning-workerStep', 'ms', 'Menggunakan worker tenant'),
('trans-provisioning-workerStep-hi', 'key-provisioning-workerStep', 'hi', 'टेनेंट वर्कर तैनात किया जा रहा है'),
('trans-provisioning-workerStep-ta', 'key-provisioning-workerStep', 'ta', 'குத்தகை வேலையாளர் பயன்படுத்தப்படுகிறது'),
('trans-provisioning-workerStep-te', 'key-provisioning-workerStep', 'te', 'టెనెంట్ వర్కర్‌ను అమలు చేస్తోంది'),
('trans-provisioning-workerStep-bn', 'key-provisioning-workerStep', 'bn', 'টেন্যান্ট ওয়ার্কার স্থাপন করা হচ্ছে'),
('trans-provisioning-workerStep-mr', 'key-provisioning-workerStep', 'mr', 'टेनंट वर्कर तैनात केला जात आहे');

-- Activation Step
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-activationStep', 'provisioning.activationStep', 'provisioning', 'Activation code generation label', 'Generating activation code');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-activationStep-en', 'key-provisioning-activationStep', 'en', 'Generating activation code'),
('trans-provisioning-activationStep-fr', 'key-provisioning-activationStep', 'fr', 'Génération du code d''activation'),
('trans-provisioning-activationStep-de', 'key-provisioning-activationStep', 'de', 'Aktivierungscode wird generiert'),
('trans-provisioning-activationStep-es', 'key-provisioning-activationStep', 'es', 'Generando código de activación'),
('trans-provisioning-activationStep-it', 'key-provisioning-activationStep', 'it', 'Generazione codice di attivazione'),
('trans-provisioning-activationStep-th', 'key-provisioning-activationStep', 'th', 'กำลังสร้างรหัสเปิดใช้งาน'),
('trans-provisioning-activationStep-vi', 'key-provisioning-activationStep', 'vi', 'Đang tạo mã kích hoạt'),
('trans-provisioning-activationStep-id', 'key-provisioning-activationStep', 'id', 'Membuat kode aktivasi'),
('trans-provisioning-activationStep-ms', 'key-provisioning-activationStep', 'ms', 'Menjana kod pengaktifan'),
('trans-provisioning-activationStep-hi', 'key-provisioning-activationStep', 'hi', 'सक्रियण कोड उत्पन्न किया जा रहा है'),
('trans-provisioning-activationStep-ta', 'key-provisioning-activationStep', 'ta', 'செயல்படுத்தும் குறியீடு உருவாக்கப்படுகிறது'),
('trans-provisioning-activationStep-te', 'key-provisioning-activationStep', 'te', 'యాక్టివేషన్ కోడ్ ఉత్పత్తి చేయబడుతోంది'),
('trans-provisioning-activationStep-bn', 'key-provisioning-activationStep', 'bn', 'অ্যাক্টিভেশন কোড তৈরি করা হচ্ছে'),
('trans-provisioning-activationStep-mr', 'key-provisioning-activationStep', 'mr', 'सक्रियकरण कोड तयार केला जात आहे');

-- Finalize Step
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-finalizeStep', 'provisioning.finalizeStep', 'provisioning', 'Finalization step label', 'Finalizing restaurant setup');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-finalizeStep-en', 'key-provisioning-finalizeStep', 'en', 'Finalizing restaurant setup'),
('trans-provisioning-finalizeStep-fr', 'key-provisioning-finalizeStep', 'fr', 'Finalisation de la configuration du restaurant'),
('trans-provisioning-finalizeStep-de', 'key-provisioning-finalizeStep', 'de', 'Restaurant-Setup wird abgeschlossen'),
('trans-provisioning-finalizeStep-es', 'key-provisioning-finalizeStep', 'es', 'Finalizando configuración del restaurante'),
('trans-provisioning-finalizeStep-it', 'key-provisioning-finalizeStep', 'it', 'Finalizzazione configurazione ristorante'),
('trans-provisioning-finalizeStep-th', 'key-provisioning-finalizeStep', 'th', 'กำลังสรุปการตั้งค่าร้านอาหาร'),
('trans-provisioning-finalizeStep-vi', 'key-provisioning-finalizeStep', 'vi', 'Đang hoàn tất thiết lập nhà hàng'),
('trans-provisioning-finalizeStep-id', 'key-provisioning-finalizeStep', 'id', 'Menyelesaikan pengaturan restoran'),
('trans-provisioning-finalizeStep-ms', 'key-provisioning-finalizeStep', 'ms', 'Memuktamadkan persediaan restoran'),
('trans-provisioning-finalizeStep-hi', 'key-provisioning-finalizeStep', 'hi', 'रेस्तरां सेटअप अंतिम रूप दिया जा रहा है'),
('trans-provisioning-finalizeStep-ta', 'key-provisioning-finalizeStep', 'ta', 'உணவக அமைப்பு இறுதி செய்யப்படுகிறது'),
('trans-provisioning-finalizeStep-te', 'key-provisioning-finalizeStep', 'te', 'రెస్టారెంట్ సెటప్ ఖరారు చేయబడుతోంది'),
('trans-provisioning-finalizeStep-bn', 'key-provisioning-finalizeStep', 'bn', 'রেস্তোরাঁ সেটআপ চূড়ান্ত করা হচ্ছে'),
('trans-provisioning-finalizeStep-mr', 'key-provisioning-finalizeStep', 'mr', 'रेस्टॉरंट सेटअप अंतिम केले जात आहे');

-- Creating Header
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-creating', 'provisioning.creating', 'provisioning', 'Creating restaurant header', 'Creating Restaurant');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-creating-en', 'key-provisioning-creating', 'en', 'Creating Restaurant'),
('trans-provisioning-creating-fr', 'key-provisioning-creating', 'fr', 'Création du restaurant'),
('trans-provisioning-creating-de', 'key-provisioning-creating', 'de', 'Restaurant wird erstellt'),
('trans-provisioning-creating-es', 'key-provisioning-creating', 'es', 'Creando restaurante'),
('trans-provisioning-creating-it', 'key-provisioning-creating', 'it', 'Creazione ristorante'),
('trans-provisioning-creating-th', 'key-provisioning-creating', 'th', 'กำลังสร้างร้านอาหาร'),
('trans-provisioning-creating-vi', 'key-provisioning-creating', 'vi', 'Đang tạo nhà hàng'),
('trans-provisioning-creating-id', 'key-provisioning-creating', 'id', 'Membuat restoran'),
('trans-provisioning-creating-ms', 'key-provisioning-creating', 'ms', 'Mencipta restoran'),
('trans-provisioning-creating-hi', 'key-provisioning-creating', 'hi', 'रेस्तरां बनाया जा रहा है'),
('trans-provisioning-creating-ta', 'key-provisioning-creating', 'ta', 'உணவகம் உருவாக்கப்படுகிறது'),
('trans-provisioning-creating-te', 'key-provisioning-creating', 'te', 'రెస్టారెంట్ సృష్టించబడుతోంది'),
('trans-provisioning-creating-bn', 'key-provisioning-creating', 'bn', 'রেস্তোরাঁ তৈরি হচ্ছে'),
('trans-provisioning-creating-mr', 'key-provisioning-creating', 'mr', 'रेस्टॉरंट तयार केले जात आहे');

-- Completed Header
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-completed', 'provisioning.completed', 'provisioning', 'Success header', 'Restaurant Created!');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-completed-en', 'key-provisioning-completed', 'en', 'Restaurant Created!'),
('trans-provisioning-completed-fr', 'key-provisioning-completed', 'fr', 'Restaurant créé !'),
('trans-provisioning-completed-de', 'key-provisioning-completed', 'de', 'Restaurant erstellt!'),
('trans-provisioning-completed-es', 'key-provisioning-completed', 'es', '¡Restaurante creado!'),
('trans-provisioning-completed-it', 'key-provisioning-completed', 'it', 'Ristorante creato!'),
('trans-provisioning-completed-th', 'key-provisioning-completed', 'th', 'สร้างร้านอาหารสำเร็จ!'),
('trans-provisioning-completed-vi', 'key-provisioning-completed', 'vi', 'Đã tạo nhà hàng!'),
('trans-provisioning-completed-id', 'key-provisioning-completed', 'id', 'Restoran berhasil dibuat!'),
('trans-provisioning-completed-ms', 'key-provisioning-completed', 'ms', 'Restoran berjaya dicipta!'),
('trans-provisioning-completed-hi', 'key-provisioning-completed', 'hi', 'रेस्तरां बनाया गया!'),
('trans-provisioning-completed-ta', 'key-provisioning-completed', 'ta', 'உணவகம் உருவாக்கப்பட்டது!'),
('trans-provisioning-completed-te', 'key-provisioning-completed', 'te', 'రెస్టారెంట్ సృష్టించబడింది!'),
('trans-provisioning-completed-bn', 'key-provisioning-completed', 'bn', 'রেস্তোরাঁ তৈরি হয়েছে!'),
('trans-provisioning-completed-mr', 'key-provisioning-completed', 'mr', 'रेस्टॉरंट तयार केले!');

-- Failed Header
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-failed', 'provisioning.failed', 'provisioning', 'Error header', 'Creation Failed');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-failed-en', 'key-provisioning-failed', 'en', 'Creation Failed'),
('trans-provisioning-failed-fr', 'key-provisioning-failed', 'fr', 'Échec de la création'),
('trans-provisioning-failed-de', 'key-provisioning-failed', 'de', 'Erstellung fehlgeschlagen'),
('trans-provisioning-failed-es', 'key-provisioning-failed', 'es', 'Creación fallida'),
('trans-provisioning-failed-it', 'key-provisioning-failed', 'it', 'Creazione fallita'),
('trans-provisioning-failed-th', 'key-provisioning-failed', 'th', 'การสร้างล้มเหลว'),
('trans-provisioning-failed-vi', 'key-provisioning-failed', 'vi', 'Tạo thất bại'),
('trans-provisioning-failed-id', 'key-provisioning-failed', 'id', 'Pembuatan gagal'),
('trans-provisioning-failed-ms', 'key-provisioning-failed', 'ms', 'Penciptaan gagal'),
('trans-provisioning-failed-hi', 'key-provisioning-failed', 'hi', 'निर्माण विफल'),
('trans-provisioning-failed-ta', 'key-provisioning-failed', 'ta', 'உருவாக்கம் தோல்வியடைந்தது'),
('trans-provisioning-failed-te', 'key-provisioning-failed', 'te', 'సృష్టి విఫలమైంది'),
('trans-provisioning-failed-bn', 'key-provisioning-failed', 'bn', 'তৈরি ব্যর্থ হয়েছে'),
('trans-provisioning-failed-mr', 'key-provisioning-failed', 'mr', 'निर्मिती अयशस्वी');

-- Please Wait Message
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-pleaseWait', 'provisioning.pleaseWait', 'provisioning', 'Please wait message', 'Please wait while we set up your infrastructure');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-pleaseWait-en', 'key-provisioning-pleaseWait', 'en', 'Please wait while we set up your infrastructure'),
('trans-provisioning-pleaseWait-fr', 'key-provisioning-pleaseWait', 'fr', 'Veuillez patienter pendant que nous configurons votre infrastructure'),
('trans-provisioning-pleaseWait-de', 'key-provisioning-pleaseWait', 'de', 'Bitte warten Sie, während wir Ihre Infrastruktur einrichten'),
('trans-provisioning-pleaseWait-es', 'key-provisioning-pleaseWait', 'es', 'Por favor espere mientras configuramos su infraestructura'),
('trans-provisioning-pleaseWait-it', 'key-provisioning-pleaseWait', 'it', 'Attendere mentre configuriamo la tua infrastruttura'),
('trans-provisioning-pleaseWait-th', 'key-provisioning-pleaseWait', 'th', 'โปรดรอสักครู่ขณะที่เราตั้งค่าโครงสร้างพื้นฐานของคุณ'),
('trans-provisioning-pleaseWait-vi', 'key-provisioning-pleaseWait', 'vi', 'Vui lòng đợi trong khi chúng tôi thiết lập hạ tầng của bạn'),
('trans-provisioning-pleaseWait-id', 'key-provisioning-pleaseWait', 'id', 'Harap tunggu sementara kami menyiapkan infrastruktur Anda'),
('trans-provisioning-pleaseWait-ms', 'key-provisioning-pleaseWait', 'ms', 'Sila tunggu sementara kami menyediakan infrastruktur anda'),
('trans-provisioning-pleaseWait-hi', 'key-provisioning-pleaseWait', 'hi', 'कृपया प्रतीक्षा करें जब तक हम आपकी बुनियादी सुविधा स्थापित करते हैं'),
('trans-provisioning-pleaseWait-ta', 'key-provisioning-pleaseWait', 'ta', 'உங்கள் உள்கட்டமைப்பை அமைக்கும் வரை காத்திருக்கவும்'),
('trans-provisioning-pleaseWait-te', 'key-provisioning-pleaseWait', 'te', 'మేము మీ మౌలిక సదుపాయాలను సెటప్ చేస్తున్నప్పుడు దయచేసి వేచి ఉండండి'),
('trans-provisioning-pleaseWait-bn', 'key-provisioning-pleaseWait', 'bn', 'আমরা আপনার অবকাঠামো সেটআপ করার সময় অপেক্ষা করুন'),
('trans-provisioning-pleaseWait-mr', 'key-provisioning-pleaseWait', 'mr', 'कृपया प्रतीक्षा करा जोपर्यंत आम्ही तुमची पायाभूत सुविधा सेटअप करत आहोत');

-- Ready Message
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-readyMessage', 'provisioning.readyMessage', 'provisioning', 'Success message', 'Your restaurant is ready to activate');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-readyMessage-en', 'key-provisioning-readyMessage', 'en', 'Your restaurant is ready to activate'),
('trans-provisioning-readyMessage-fr', 'key-provisioning-readyMessage', 'fr', 'Votre restaurant est prêt à être activé'),
('trans-provisioning-readyMessage-de', 'key-provisioning-readyMessage', 'de', 'Ihr Restaurant ist bereit zur Aktivierung'),
('trans-provisioning-readyMessage-es', 'key-provisioning-readyMessage', 'es', 'Su restaurante está listo para activar'),
('trans-provisioning-readyMessage-it', 'key-provisioning-readyMessage', 'it', 'Il tuo ristorante è pronto per l''attivazione'),
('trans-provisioning-readyMessage-th', 'key-provisioning-readyMessage', 'th', 'ร้านอาหารของคุณพร้อมเปิดใช้งาน'),
('trans-provisioning-readyMessage-vi', 'key-provisioning-readyMessage', 'vi', 'Nhà hàng của bạn đã sẵn sàng kích hoạt'),
('trans-provisioning-readyMessage-id', 'key-provisioning-readyMessage', 'id', 'Restoran Anda siap diaktifkan'),
('trans-provisioning-readyMessage-ms', 'key-provisioning-readyMessage', 'ms', 'Restoran anda bersedia untuk diaktifkan'),
('trans-provisioning-readyMessage-hi', 'key-provisioning-readyMessage', 'hi', 'आपका रेस्तरां सक्रिय करने के लिए तैयार है'),
('trans-provisioning-readyMessage-ta', 'key-provisioning-readyMessage', 'ta', 'உங்கள் உணவகம் செயல்படுத்த தயாராக உள்ளது'),
('trans-provisioning-readyMessage-te', 'key-provisioning-readyMessage', 'te', 'మీ రెస్టారెంట్ యాక్టివేట్ చేయడానికి సిద్ధంగా ఉంది'),
('trans-provisioning-readyMessage-bn', 'key-provisioning-readyMessage', 'bn', 'আপনার রেস্তোরাঁ সক্রিয় করার জন্য প্রস্তুত'),
('trans-provisioning-readyMessage-mr', 'key-provisioning-readyMessage', 'mr', 'तुमचे रेस्टॉरंट सक्रिय करण्यासाठी तयार आहे');

-- Error Message
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-errorMessage', 'provisioning.errorMessage', 'provisioning', 'Error message', 'An error occurred during provisioning');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-errorMessage-en', 'key-provisioning-errorMessage', 'en', 'An error occurred during provisioning'),
('trans-provisioning-errorMessage-fr', 'key-provisioning-errorMessage', 'fr', 'Une erreur s''est produite lors du provisionnement'),
('trans-provisioning-errorMessage-de', 'key-provisioning-errorMessage', 'de', 'Bei der Bereitstellung ist ein Fehler aufgetreten'),
('trans-provisioning-errorMessage-es', 'key-provisioning-errorMessage', 'es', 'Ocurrió un error durante el aprovisionamiento'),
('trans-provisioning-errorMessage-it', 'key-provisioning-errorMessage', 'it', 'Si è verificato un errore durante il provisioning'),
('trans-provisioning-errorMessage-th', 'key-provisioning-errorMessage', 'th', 'เกิดข้อผิดพลาดระหว่างการจัดเตรียม'),
('trans-provisioning-errorMessage-vi', 'key-provisioning-errorMessage', 'vi', 'Đã xảy ra lỗi trong quá trình cung cấp'),
('trans-provisioning-errorMessage-id', 'key-provisioning-errorMessage', 'id', 'Terjadi kesalahan saat penyediaan'),
('trans-provisioning-errorMessage-ms', 'key-provisioning-errorMessage', 'ms', 'Ralat berlaku semasa penyediaan'),
('trans-provisioning-errorMessage-hi', 'key-provisioning-errorMessage', 'hi', 'प्रावधान के दौरान एक त्रुटि हुई'),
('trans-provisioning-errorMessage-ta', 'key-provisioning-errorMessage', 'ta', 'வழங்குதலின் போது பிழை ஏற்பட்டது'),
('trans-provisioning-errorMessage-te', 'key-provisioning-errorMessage', 'te', 'ప్రొవిజనింగ్ సమయంలో లోపం సంభవించింది'),
('trans-provisioning-errorMessage-bn', 'key-provisioning-errorMessage', 'bn', 'প্রদানের সময় একটি ত্রুটি ঘটেছে'),
('trans-provisioning-errorMessage-mr', 'key-provisioning-errorMessage', 'mr', 'तरतुदीदरम्यान एक त्रुटी आली');

-- Completed In (with parameter)
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-completedIn', 'provisioning.completedIn', 'provisioning', 'Completion time (supports {{seconds}} param)', 'Completed in {{seconds}}s');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-completedIn-en', 'key-provisioning-completedIn', 'en', 'Completed in {{seconds}}s'),
('trans-provisioning-completedIn-fr', 'key-provisioning-completedIn', 'fr', 'Terminé en {{seconds}}s'),
('trans-provisioning-completedIn-de', 'key-provisioning-completedIn', 'de', 'Abgeschlossen in {{seconds}}s'),
('trans-provisioning-completedIn-es', 'key-provisioning-completedIn', 'es', 'Completado en {{seconds}}s'),
('trans-provisioning-completedIn-it', 'key-provisioning-completedIn', 'it', 'Completato in {{seconds}}s'),
('trans-provisioning-completedIn-th', 'key-provisioning-completedIn', 'th', 'เสร็จสิ้นใน {{seconds}} วินาที'),
('trans-provisioning-completedIn-vi', 'key-provisioning-completedIn', 'vi', 'Hoàn thành trong {{seconds}}s'),
('trans-provisioning-completedIn-id', 'key-provisioning-completedIn', 'id', 'Selesai dalam {{seconds}}s'),
('trans-provisioning-completedIn-ms', 'key-provisioning-completedIn', 'ms', 'Selesai dalam {{seconds}}s'),
('trans-provisioning-completedIn-hi', 'key-provisioning-completedIn', 'hi', '{{seconds}} सेकंड में पूर्ण'),
('trans-provisioning-completedIn-ta', 'key-provisioning-completedIn', 'ta', '{{seconds}} வினாடிகளில் நிறைவடைந்தது'),
('trans-provisioning-completedIn-te', 'key-provisioning-completedIn', 'te', '{{seconds}} సెకన్లలో పూర్తయింది'),
('trans-provisioning-completedIn-bn', 'key-provisioning-completedIn', 'bn', '{{seconds}} সেকেন্ডে সম্পন্ন'),
('trans-provisioning-completedIn-mr', 'key-provisioning-completedIn', 'mr', '{{seconds}} सेकंदात पूर्ण');

-- Activation Code Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-activationCode', 'provisioning.activationCode', 'provisioning', 'Activation code label', 'Activation Code');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-activationCode-en', 'key-provisioning-activationCode', 'en', 'Activation Code'),
('trans-provisioning-activationCode-fr', 'key-provisioning-activationCode', 'fr', 'Code d''activation'),
('trans-provisioning-activationCode-de', 'key-provisioning-activationCode', 'de', 'Aktivierungscode'),
('trans-provisioning-activationCode-es', 'key-provisioning-activationCode', 'es', 'Código de activación'),
('trans-provisioning-activationCode-it', 'key-provisioning-activationCode', 'it', 'Codice di attivazione'),
('trans-provisioning-activationCode-th', 'key-provisioning-activationCode', 'th', 'รหัสเปิดใช้งาน'),
('trans-provisioning-activationCode-vi', 'key-provisioning-activationCode', 'vi', 'Mã kích hoạt'),
('trans-provisioning-activationCode-id', 'key-provisioning-activationCode', 'id', 'Kode aktivasi'),
('trans-provisioning-activationCode-ms', 'key-provisioning-activationCode', 'ms', 'Kod pengaktifan'),
('trans-provisioning-activationCode-hi', 'key-provisioning-activationCode', 'hi', 'सक्रियण कोड'),
('trans-provisioning-activationCode-ta', 'key-provisioning-activationCode', 'ta', 'செயல்படுத்தும் குறியீடு'),
('trans-provisioning-activationCode-te', 'key-provisioning-activationCode', 'te', 'యాక్టివేషన్ కోడ్'),
('trans-provisioning-activationCode-bn', 'key-provisioning-activationCode', 'bn', 'অ্যাক্টিভেশন কোড'),
('trans-provisioning-activationCode-mr', 'key-provisioning-activationCode', 'mr', 'सक्रियकरण कोड');

-- Copy to Clipboard
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-copyToClipboard', 'provisioning.copyToClipboard', 'provisioning', 'Copy button tooltip', 'Copy to clipboard');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-copyToClipboard-en', 'key-provisioning-copyToClipboard', 'en', 'Copy to clipboard'),
('trans-provisioning-copyToClipboard-fr', 'key-provisioning-copyToClipboard', 'fr', 'Copier dans le presse-papiers'),
('trans-provisioning-copyToClipboard-de', 'key-provisioning-copyToClipboard', 'de', 'In Zwischenablage kopieren'),
('trans-provisioning-copyToClipboard-es', 'key-provisioning-copyToClipboard', 'es', 'Copiar al portapapeles'),
('trans-provisioning-copyToClipboard-it', 'key-provisioning-copyToClipboard', 'it', 'Copia negli appunti'),
('trans-provisioning-copyToClipboard-th', 'key-provisioning-copyToClipboard', 'th', 'คัดลอกไปยังคลิปบอร์ด'),
('trans-provisioning-copyToClipboard-vi', 'key-provisioning-copyToClipboard', 'vi', 'Sao chép vào clipboard'),
('trans-provisioning-copyToClipboard-id', 'key-provisioning-copyToClipboard', 'id', 'Salin ke clipboard'),
('trans-provisioning-copyToClipboard-ms', 'key-provisioning-copyToClipboard', 'ms', 'Salin ke papan keratan'),
('trans-provisioning-copyToClipboard-hi', 'key-provisioning-copyToClipboard', 'hi', 'क्लिपबोर्ड पर कॉपी करें'),
('trans-provisioning-copyToClipboard-ta', 'key-provisioning-copyToClipboard', 'ta', 'கிளிப்போர்டில் நகலெடுக்கவும்'),
('trans-provisioning-copyToClipboard-te', 'key-provisioning-copyToClipboard', 'te', 'క్లిప్‌బోర్డ్‌కు కాపీ చేయండి'),
('trans-provisioning-copyToClipboard-bn', 'key-provisioning-copyToClipboard', 'bn', 'ক্লিপবোর্ডে কপি করুন'),
('trans-provisioning-copyToClipboard-mr', 'key-provisioning-copyToClipboard', 'mr', 'क्लिपबोर्डवर कॉपी करा');

-- Save Code Message
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-saveCodeMessage', 'provisioning.saveCodeMessage', 'provisioning', 'Activation code helper text', 'Save this code - you''ll need it to activate your POS system');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-saveCodeMessage-en', 'key-provisioning-saveCodeMessage', 'en', 'Save this code - you''ll need it to activate your POS system'),
('trans-provisioning-saveCodeMessage-fr', 'key-provisioning-saveCodeMessage', 'fr', 'Enregistrez ce code - vous en aurez besoin pour activer votre système POS'),
('trans-provisioning-saveCodeMessage-de', 'key-provisioning-saveCodeMessage', 'de', 'Speichern Sie diesen Code - Sie benötigen ihn zur Aktivierung Ihres POS-Systems'),
('trans-provisioning-saveCodeMessage-es', 'key-provisioning-saveCodeMessage', 'es', 'Guarde este código: lo necesitará para activar su sistema POS'),
('trans-provisioning-saveCodeMessage-it', 'key-provisioning-saveCodeMessage', 'it', 'Salva questo codice: ti servirà per attivare il tuo sistema POS'),
('trans-provisioning-saveCodeMessage-th', 'key-provisioning-saveCodeMessage', 'th', 'บันทึกรหัสนี้ - คุณจะต้องใช้เพื่อเปิดใช้งานระบบ POS'),
('trans-provisioning-saveCodeMessage-vi', 'key-provisioning-saveCodeMessage', 'vi', 'Lưu mã này - bạn sẽ cần nó để kích hoạt hệ thống POS'),
('trans-provisioning-saveCodeMessage-id', 'key-provisioning-saveCodeMessage', 'id', 'Simpan kode ini - Anda akan membutuhkannya untuk mengaktifkan sistem POS'),
('trans-provisioning-saveCodeMessage-ms', 'key-provisioning-saveCodeMessage', 'ms', 'Simpan kod ini - anda memerlukannya untuk mengaktifkan sistem POS'),
('trans-provisioning-saveCodeMessage-hi', 'key-provisioning-saveCodeMessage', 'hi', 'इस कोड को सहेजें - अपने POS सिस्टम को सक्रिय करने के लिए आपको इसकी आवश्यकता होगी'),
('trans-provisioning-saveCodeMessage-ta', 'key-provisioning-saveCodeMessage', 'ta', 'இந்த குறியீட்டை சேமிக்கவும் - உங்கள் POS அமைப்பை செயல்படுத்த இது தேவை'),
('trans-provisioning-saveCodeMessage-te', 'key-provisioning-saveCodeMessage', 'te', 'ఈ కోడ్‌ను సేవ్ చేయండి - మీ POS సిస్టమ్‌ను యాక్టివేట్ చేయడానికి మీకు ఇది అవసరం'),
('trans-provisioning-saveCodeMessage-bn', 'key-provisioning-saveCodeMessage', 'bn', 'এই কোডটি সংরক্ষণ করুন - আপনার POS সিস্টেম সক্রিয় করতে এটি প্রয়োজন হবে'),
('trans-provisioning-saveCodeMessage-mr', 'key-provisioning-saveCodeMessage', 'mr', 'हा कोड जतन करा - तुमची POS प्रणाली सक्रिय करण्यासाठी तुम्हाला याची आवश्यकता असेल');

-- Continue Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-provisioning-continueButton', 'provisioning.continueButton', 'provisioning', 'Continue to activation button', 'Continue to Activation');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-provisioning-continueButton-en', 'key-provisioning-continueButton', 'en', 'Continue to Activation'),
('trans-provisioning-continueButton-fr', 'key-provisioning-continueButton', 'fr', 'Continuer vers l''activation'),
('trans-provisioning-continueButton-de', 'key-provisioning-continueButton', 'de', 'Weiter zur Aktivierung'),
('trans-provisioning-continueButton-es', 'key-provisioning-continueButton', 'es', 'Continuar a la activación'),
('trans-provisioning-continueButton-it', 'key-provisioning-continueButton', 'it', 'Continua all''attivazione'),
('trans-provisioning-continueButton-th', 'key-provisioning-continueButton', 'th', 'ดำเนินการต่อเพื่อเปิดใช้งาน'),
('trans-provisioning-continueButton-vi', 'key-provisioning-continueButton', 'vi', 'Tiếp tục kích hoạt'),
('trans-provisioning-continueButton-id', 'key-provisioning-continueButton', 'id', 'Lanjutkan ke aktivasi'),
('trans-provisioning-continueButton-ms', 'key-provisioning-continueButton', 'ms', 'Teruskan ke pengaktifan'),
('trans-provisioning-continueButton-hi', 'key-provisioning-continueButton', 'hi', 'सक्रियण के लिए जारी रखें'),
('trans-provisioning-continueButton-ta', 'key-provisioning-continueButton', 'ta', 'செயல்படுத்தலுக்கு தொடரவும்'),
('trans-provisioning-continueButton-te', 'key-provisioning-continueButton', 'te', 'యాక్టివేషన్‌కు కొనసాగించండి'),
('trans-provisioning-continueButton-bn', 'key-provisioning-continueButton', 'bn', 'সক্রিয়করণে চালিয়ে যান'),
('trans-provisioning-continueButton-mr', 'key-provisioning-continueButton', 'mr', 'सक्रियकरणाकडे सुरू ठेवा');
```

---

## Next Steps

1. **Add remaining SQL** for all onboarding keys to `022_seed_translations.sql`
2. **Add provisioning SQL** (above) to `022_seed_translations.sql`
3. **Run migration** to populate database
4. **Test** complete onboarding + provisioning flow in all 13 languages
5. **Extend pattern** to other components (Hub, Settings, POS, etc.)
