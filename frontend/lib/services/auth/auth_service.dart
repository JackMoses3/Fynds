import 'package:dio/dio.dart';
import 'package:frontend/core/dio_client.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthService {
  final Dio _dio = DioClient().client;
  final _storage = FlutterSecureStorage();
  final GoogleSignIn _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);

  // Saves the access and refresh tokens to secure storage
  Future<void> _saveTokens(Map<String, dynamic> data) async {
    await _storage.write(key: 'access_token', value: data['access_token']);
    await _storage.write(key: 'refresh_token', value: data['refresh_token']);
  }

  Future<bool> loginWithEmail(String email, String password) async {
    try {
      final response = await _dio.post(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      await _saveTokens(response.data);
      return true;
    } catch (e) {
      print('Login error: $e');
      return false;
    }
  }

  Future<bool> loginWithGoogle() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return false; // Cancelled

      final googleAuth = await googleUser.authentication;

      // Send id_token to your backend
      final response = await _dio.post(
        '/auth/google/token',
        data: {'idToken': googleAuth.idToken},
      );

      await _saveTokens(response.data);
      return true;
      // Save this accessToken securely and use for authenticated requests
    } catch (e) {
      print("Login failed: $e");
      return false;
    }
  }

  Future<bool> registerWithEmail(
    String email,
    String firstName,
    String lastName,
    String password,
  ) async {
    try {
      final response = await _dio.post(
        '/auth/register',
        data: {
          'email': email,
          'firstName': firstName,
          'lastName': lastName,
          'password': password,
        },
      );
      print('Registration successful: ${response.data}');
      return true;
    } catch (e) {
      print('Registration error: $e');
      return false;
    }
  }

  Future<bool> verifyEmail(String email, String code) async {
    try {
      final response = await _dio.post(
        '/auth/verify',
        data: {'email': email, 'code': code},
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Verification error: $e');
      return false;
    }
  }
}
