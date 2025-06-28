import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/style.dart';

// New model for the simplified response
class OnboardingProduct {
  final int id;
  final Uint8List imageBytes;

  OnboardingProduct({required this.id, required this.imageBytes});

  factory OnboardingProduct.fromJson(Map<String, dynamic> json) {
    final base64Image = json['imageData'] as String;
    final imageBytes = base64Decode(base64Image);

    return OnboardingProduct(id: json['id'] as int, imageBytes: imageBytes);
  }

  // Convert to Image widget for display - REMOVED TINT
  Widget get image {
    return Image.memory(
      imageBytes,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          color: Colors.grey[200], // Lighter error background
          child: const Icon(
            Icons.image_not_supported_outlined,
            color: Colors.grey,
            size: 32,
          ),
        );
      },
    );
  }

  // Get image as Image widget with custom properties - REMOVED TINT
  Widget imageWidget({
    BoxFit fit = BoxFit.cover,
    double? width,
    double? height,
  }) {
    return Image.memory(
      imageBytes,
      fit: fit,
      width: width,
      height: height,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          width: width,
          height: height,
          color: Colors.grey[200], // Lighter error background
          child: const Icon(
            Icons.image_not_supported_outlined,
            color: Colors.grey,
            size: 32,
          ),
        );
      },
    );
  }
}

// Onboarding service to handle all onboarding-related API calls
class OnboardingService {
  final Dio _dio = DioClient().client;
  final _storage = const FlutterSecureStorage();

  /// Step 1: Save user's additional information
  Future<bool> additionalUserInformation({
    required String clothingPreferences,
    required DateTime? birthDate,
    required String location,
  }) async {
    try {
      final formattedDate =
          birthDate != null
              ? '${birthDate.year.toString().padLeft(4, '0')}-'
                  '${birthDate.month.toString().padLeft(2, '0')}-'
                  '${birthDate.day.toString().padLeft(2, '0')}'
              : null;

      print('🐛 Request to /user/onboarding/additional-info');
      print(
        '🐛 Data: clothingPreferences=$clothingPreferences, '
        'birthDate=$formattedDate, location=$location',
      );

      final resp = await _dio.post(
        '/user/onboarding/additional-info',
        data: {
          'clothingPreferences': clothingPreferences,
          if (formattedDate != null) 'birthdate': formattedDate,
          'location': location,
        },
      );

      print('🐛 Status: ${resp.statusCode}, data: ${resp.data}');
      return resp.statusCode == 200;
    } catch (e) {
      print('🐛 additionalUserInformation error: $e');
      if (e is DioException) {
        print('🐛 DioException status: ${e.response?.statusCode}');
        print('🐛 DioException data: ${e.response?.data}');
      }
      return false;
    }
  }

  /// Step 2: Get all available styles
  Future<List<Style>> getStyles() async {
    try {
      final resp = await _dio.get('/style');
      if (resp.statusCode == 200) {
        final data = resp.data as List<dynamic>;
        return data.map((json) => Style.fromJson(json)).toList();
      }
      throw Exception('Failed to load styles');
    } catch (e) {
      print('🐛 getStyles error: $e');
      rethrow;
    }
  }

  /// Step 3: Assign selected styles to user
  Future<void> assignStylesToUser(List<int> styleIds) async {
    try {
      final resp = await _dio.post(
        '/user/assign-styles',
        data: {'styleIds': styleIds},
      );
      if (resp.statusCode != 200 && resp.statusCode != 201) {
        throw Exception('Failed to assign styles');
      }
    } catch (e) {
      print('🐛 assignStylesToUser error: $e');
      rethrow;
    }
  }

  /// Step 4: Get user's saved clothing preference
  Future<String> getClothingPreference() async {
    try {
      final resp = await _dio.get('/user/clothing-preference');
      if (resp.statusCode == 200 && resp.data is Map) {
        return (resp.data as Map<String, dynamic>)['clothingPreference']
                as String? ??
            'Both';
      }
      return 'Both';
    } catch (e) {
      print('Error getting clothing preference: $e');
      return 'Both';
    }
  }

  /// Fetch 25 products for onboarding with base64 images
  Future<List<OnboardingProduct>> getStyleProducts({
    required List<int> selectedStyleIds,
    int limit = 25,
  }) async {
    try {
      final pref = await _storage.read(key: 'sex');

      print('🐛 Fetching onboarding products...');
      print(
        '🐛 StyleIds: ${selectedStyleIds.join(',')}, Preference: $pref, Limit: $limit',
      );

      final resp = await _dio.post(
        '/onboarding/style-products',
        data: {
          'styleIds': selectedStyleIds,
          'clothingPreference': pref,
          'limit': limit,
        },
      );

      // ✅ Accept both 200 and 201 as success
      if (resp.statusCode != 200 && resp.statusCode != 201) {
        throw Exception('Failed to fetch products: ${resp.statusCode}');
      }

      final data = resp.data as List<dynamic>;
      print('✅ Received ${data.length} products from backend');

      final products =
          data.map((productJson) {
            final productMap = productJson as Map<String, dynamic>;
            return OnboardingProduct.fromJson(productMap);
          }).toList();

      return products;
    } catch (e) {
      print('🐛 Error in getStyleProducts: $e');
      if (e is DioException) {
        print('🐛 DioException status: ${e.response?.statusCode}');
        print('🐛 DioException data: ${e.response?.data}');
      }
      rethrow;
    }
  }

  /// Step 6: Save only the **selected** onboarding products
  Future<void> saveOnboardingSelections(List<int> productIds) async {
    try {
      final resp = await _dio.post(
        '/onboarding/complete',
        data: {'selectedIds': productIds},
      );
      if (resp.statusCode != 200 && resp.statusCode != 201) {
        throw Exception('Failed to save selections: ${resp.statusCode}');
      }
      print('✅ Successfully saved ${productIds.length} onboarding selections');
    } catch (e) {
      print('🐛 Error saving onboarding selections: $e');
      rethrow;
    }
  }
}
