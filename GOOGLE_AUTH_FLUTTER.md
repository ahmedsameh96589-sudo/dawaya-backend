# 🔐 Google OAuth — Flutter Integration Guide

## الـ Flow بالكامل

```
Flutter App
    ↓
Google Sign-In SDK   ← المستخدم يختار حسابه
    ↓
idToken (JWT من Google)
    ↓
POST /api/auth/google  { idToken }
    ↓
Backend يـ verify مع Google
    ↓
يرجع JWT Token بتاع DAWAYA ✅
```

---

## 📱 إعداد Flutter

### 1. أضف الـ Package في `pubspec.yaml`

```yaml
dependencies:
  google_sign_in: ^6.2.1
  http: ^1.2.0
```

### 2. إعداد Android — `android/app/build.gradle`

```gradle
android {
    defaultConfig {
        minSdkVersion 21
    }
}
```

### 3. أضف `google-services.json`

- اذهب إلى [console.firebase.google.com](https://console.firebase.google.com)
- أضف مشروع Android → حمّل `google-services.json` → ضعه في `android/app/`

في `android/build.gradle`:
```gradle
classpath 'com.google.gms:google-services:4.4.0'
```

في `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### 4. إعداد iOS — `ios/Runner/Info.plist`

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>YOUR_REVERSED_CLIENT_ID</string>
    </array>
  </dict>
</array>
```

---

## 💻 كود Flutter الكامل

```dart
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class AuthService {
  static const String baseUrl = 'http://192.168.1.x:5000/api'; // IP بتاعك

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  Future<Map<String, dynamic>> signInWithGoogle() async {
    try {
      // 1. فتح نافذة اختيار حساب Google
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        return {'success': false, 'message': 'Sign-in cancelled'};
      }

      // 2. جيب الـ authentication details
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;
      final String? idToken = googleAuth.idToken;

      if (idToken == null) {
        return {'success': false, 'message': 'Failed to get ID token'};
      }

      // 3. ابعت الـ idToken للـ Backend
      final response = await http.post(
        Uri.parse('$baseUrl/auth/google'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'idToken': idToken}),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'token': data['token'],
          'user': data['data']['user'],
          'isNewUser': response.statusCode == 201,
          'message': data['message'],
        };
      } else {
        return {'success': false, 'message': data['message']};
      }
    } catch (e) {
      return {'success': false, 'message': 'Error: $e'};
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
  }
}
```

---

## 🎨 زر Google في الـ UI

```dart
ElevatedButton.icon(
  onPressed: () async {
    final result = await AuthService().signInWithGoogle();
    if (result['success']) {
      // احفظ الـ token وروح للـ home screen
      print('Welcome ${result['user']['name']}');
    } else {
      print('Error: ${result['message']}');
    }
  },
  icon: Image.asset('assets/google_logo.png', height: 24),
  label: const Text('Continue with Google'),
  style: ElevatedButton.styleFrom(
    backgroundColor: Colors.white,
    foregroundColor: Colors.black87,
    elevation: 2,
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
  ),
),
```

---

## ⚙️ إعداد Google Cloud Console

1. اذهب إلى [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
3. اختر **Android** وأضف:
   - Package name: `com.yourcompany.dawaya`
   - SHA-1 fingerprint:
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
4. انسخ الـ **Client ID** وحطه في `.env`:
```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
```

---

## 🧪 اختبار في Postman

```
POST http://localhost:5000/api/auth/google
Content-Type: application/json

{ "idToken": "eyJhbGc..." }
```

**Response — مستخدم جديد (201):**
```json
{
  "success": true,
  "message": "Account created successfully with Google. Welcome to DAWAYA! 🎉",
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "data": {
    "user": {
      "name": "Waleed Hesham",
      "email": "waleed@gmail.com",
      "avatar": "https://lh3.googleusercontent.com/...",
      "authProvider": "google",
      "isVerified": true
    }
  }
}
```

**Response — مستخدم موجود (200):**
```json
{
  "success": true,
  "message": "Login with Google successful.",
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

---

## 📋 السيناريوهات

| الحالة | النتيجة |
|--------|---------|
| مستخدم جديد بـ Google | يتسجل تلقائياً + verified + يرجع token (201) |
| مستخدم موجود بنفس الـ email | يُربط حسابه بـ Google + يرجع token (200) |
| مستخدم موجود ومربوط بالفعل | Login مباشرة + يرجع token (200) |
| Token غلط أو منتهي | 401 Invalid token |
| حساب Google email غير verified | 400 Error |
| حساب deactivated | 403 Error |
