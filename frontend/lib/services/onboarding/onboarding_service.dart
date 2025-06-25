import 'dart:convert';
import 'dart:math' as math;
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/models/style.dart';

class OnboardingService {
  // HTTP base for all your API endpoints:
  static const String _apiBaseUrl = 'http://10.0.2.2:3000/api';

  // Server base for turning "/api/..." image paths into full URLs:
  static const String _serverBaseUrl = 'http://10.0.2.2:3000';

  final Dio _dio = Dio(BaseOptions(baseUrl: _apiBaseUrl));

  Future<Options> _options() async {
    final token = await const FlutterSecureStorage().read(key: 'access_token');
    return Options(
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    );
  }

  /// Step 1: Save user's additional information
  Future<bool> additionalUserInformation({
    required String clothingPreferences,
    required DateTime birthDate,
    required String location,
  }) async {
    try {
      final formattedDate =
          '${birthDate.year.toString().padLeft(4, '0')}-'
          '${birthDate.month.toString().padLeft(2, '0')}-'
          '${birthDate.day.toString().padLeft(2, '0')}';

      print('🐛 Request to /user/onboarding/additional-info');
      print(
        '🐛 Data: clothingPreferences=$clothingPreferences, '
        'birthDate=$formattedDate, location=$location',
      );

      final resp = await _dio.post(
        '/user/onboarding/additional-info',
        data: {
          'clothingPreferences': clothingPreferences,
          'birthdate': formattedDate,
          'location': location,
        },
        options: await _options(),
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

  /// Get all available styles
  Future<List<Style>?> getStyles() async {
    try {
      final resp = await _dio.get('/style', options: await _options());
      return (resp.data as List)
          .map((j) => Style.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error fetching styles: $e');
      return null;
    }
  }

  /// Assign the chosen style IDs to the user
  Future<bool> assignStylesToUser(List<int> styleIds) async {
    try {
      final resp = await _dio.post(
        '/user/assign-styles',
        data: {'styleIds': styleIds},
        options: await _options(),
      );
      return resp.statusCode == 200;
    } catch (e) {
      print('Error assigning styles: $e');
      return false;
    }
  }

  /// Get the user's clothing preference
  Future<String> getClothingPreference() async {
    try {
      final resp = await _dio.get(
        '/user/clothing-preference',
        options: await _options(),
      );
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

  /// Fetch 25 products for onboarding
  Future<List<ProductItem>> getStyleProducts({
    required List<int> selectedStyleIds,
    int limit = 25,
  }) async {
    final pref = await getClothingPreference();
    final styleIdsParam = selectedStyleIds.join(',');
    final resp = await _dio.get(
      '/onboarding/style-products',
      queryParameters: {
        'styleIds': styleIdsParam,
        'clothingPreference': pref,
        'limit': limit,
      },
      options: await _options(),
    );

    final data = resp.data as List<dynamic>;
    final products =
        data.map((productJson) {
          final m = productJson as Map<String, dynamic>;

          // Rewrite every backend‐returned "/api/..." image URL
          if (m['images'] is List) {
            for (var img in m['images'] as List) {
              final path = img['imageUrl'] as String;
              // e.g. "/api/onboarding/images/men_images/styles/2/6822.jpg"
              img['imageUrl'] = '$_serverBaseUrl$path';
            }
          }

          return ProductItem.fromJson(m);
        }).toList();

    // Optional debug
    for (int i = 0; i < math.min(3, products.length); i++) {
      print(
        '🖼️ [OnboardingService] Product ${products[i].id} '
        'image: ${products[i].images.first.imageUrl}',
      );
    }
    return products;
  }

  /// Step 6: Save only the **selected** onboarding products
  Future<void> saveOnboardingSelections(List<int> productIds) async {
    final resp = await _dio.post(
      '/onboarding/complete',
      data: {'selectedIds': productIds},
      options: await _options(),
    );
    if (resp.statusCode != 200 && resp.statusCode != 201) {
      throw Exception('Failed to save selections: ${resp.statusCode}');
    }
  }
}
