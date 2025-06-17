import 'dart:convert';
import 'dart:math' as math;
import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/style.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class OnboardingService {
  static const String _baseUrl = 'http://10.0.2.2:3000/api';
  final Dio _dio = DioClient().client;

  /// Get HTTP headers with authentication token
  Future<Map<String, String>> _getHeaders() async {
    final token = await const FlutterSecureStorage().read(key: 'access_token');
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Step 1: Save user's additional information (clothing preference, birthdate, location)
  Future<bool> additionalUserInformation({
    required String clothingPreferences,
    required DateTime birthDate,
    required String location,
  }) async {
    try {
      // Format date as YYYY-MM-DD to avoid timezone issues
      // This preserves the exact date the user selected
      final formattedDate =
          '${birthDate.year.toString().padLeft(4, '0')}-'
          '${birthDate.month.toString().padLeft(2, '0')}-'
          '${birthDate.day.toString().padLeft(2, '0')}';

      print('🐛 Making request to /user/onboarding/additional-info');
      print(
        '🐛 Data: clothingPreferences=$clothingPreferences, birthDate=$formattedDate, location=$location',
      );

      final response = await _dio.post(
        'user/onboarding/additional-info',
        data: {
          'clothingPreferences': clothingPreferences,
          'birthdate': formattedDate, // Use YYYY-MM-DD format
          'location': location,
        },
      );

      print('🐛 Response status: ${response.statusCode}');
      print('🐛 Response data: ${response.data}');

      return response.statusCode == 200;
    } catch (e) {
      print('🐛 additionalUserInformation error: $e');
      if (e is DioException) {
        print('🐛 DioException status: ${e.response?.statusCode}');
        print('🐛 DioException data: ${e.response?.data}');
      }
      return false;
    }
  }

  /// Step 2: Get all available styles for user selection
  Future<List<Style>?> getStyles() async {
    try {
      final response = await _dio.get('style');
      final List data = response.data;
      return data.map((json) => Style.fromJson(json)).toList();
    } catch (e) {
      print('Error fetching styles: $e');
      return null;
    }
  }

  /// Step 3: Assign selected styles to the user
  Future<bool> assignStylesToUser(List<int> styleIds) async {
    try {
      final response = await _dio.post(
        'user/assign-styles',
        data: {'styleIds': styleIds},
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Error assigning styles to user: $e');
      return false;
    }
  }

  /// Step 4: Get the user's clothing preference from backend
  Future<String> getClothingPreference() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/user/clothing-preference'),
        headers: headers,
      );

      print(
        '🐞 [OnboardingService] Clothing preference status: ${response.statusCode}',
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        final preference = data['clothingPreference'] as String? ?? 'Both';
        print('🐞 [OnboardingService] Retrieved preference: $preference');
        return preference;
      } else {
        print(
          '❌ [OnboardingService] Failed to get preference: ${response.body}',
        );
        return 'Both'; // fallback
      }
    } catch (e) {
      print('❌ [OnboardingService] Exception getting preference: $e');
      return 'Both'; // fallback
    }
  }

  /// Step 5: Get product items based on selected styles and user's clothing preference
  /// Automatically fetches clothing preference from backend
  /// Returns 25 products (12 male + 13 female if "Both", or 25 of single gender)
  Future<List<ProductItem>> getStyleProducts({
    required List<int> selectedStyleIds,
    int limit = 25,
  }) async {
    // Get clothing preference from backend
    final clothingPreference = await getClothingPreference();

    final styleIdsParam = selectedStyleIds.join(',');
    final url =
        '$_baseUrl/onboarding/style-products'
        '?styleIds=$styleIdsParam'
        '&clothingPreference=$clothingPreference'
        '&limit=$limit';

    print('🐞 [OnboardingService] GET $url');
    final response = await http.get(
      Uri.parse(url),
      headers: await _getHeaders(),
    );

    print('🐞 [OnboardingService] status: ${response.statusCode}');

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);

      final products =
          data.map((productJson) {
            // Fix image URLs to include full server path
            if (productJson['images'] is List) {
              for (var imageJson in productJson['images']) {
                if (imageJson['imageUrl'] is String) {
                  final imageUrl = imageJson['imageUrl'] as String;
                  if (imageUrl.startsWith('/api/')) {
                    imageJson['imageUrl'] = 'http://10.0.2.2:3000$imageUrl';
                  }
                }
              }
            }
            return ProductItem.fromJson(productJson);
          }).toList();

      // Log first few product image URLs for debugging
      for (int i = 0; i < math.min(3, products.length); i++) {
        final product = products[i];
        if (product.images.isNotEmpty) {
          final imageUrl = product.images.first.imageUrl;
          print(
            '🖼️ [OnboardingService] Product ${product.id} final image URL: $imageUrl',
          );
        }
      }

      return products;
    } else {
      print('❌ [OnboardingService] Error: ${response.body}');
      throw Exception('Failed to load style products: ${response.statusCode}');
    }
  }

  /// Step 6: Save user's final product selections to complete onboarding
  Future<void> saveOnboardingSelections(List<int> productIds) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$_baseUrl/user/onboarding/save-selections'),
      headers: headers,
      body: json.encode({'productIds': productIds}),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to save selections: ${response.statusCode}');
    }
  }
}
