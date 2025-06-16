import 'dart:convert';
import 'dart:math' as math;
import 'package:fynds/models/product_item/product_item.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class OnboardingService {
  static const String _baseUrl = 'http://10.0.2.2:3000/api';

  Future<Map<String, String>> _getHeaders() async {
    final token = await const FlutterSecureStorage().read(key: 'access_token');
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Get products for multiple selected styles with discovery products
  Future<List<ProductItem>> getStyleProducts({
    required List<int> selectedStyleIds,
    required String clothingPreference,
    int limit = 25,
  }) async {
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

      // Convert each product and fix image URLs
      final products =
          data.map((productJson) {
            // Convert relative URLs to absolute URLs in the JSON before parsing
            if (productJson['images'] is List) {
              for (var imageJson in productJson['images']) {
                if (imageJson['imageUrl'] is String) {
                  final imageUrl = imageJson['imageUrl'] as String;
                  if (imageUrl.startsWith('/api/')) {
                    // Convert relative to absolute
                    imageJson['imageUrl'] = 'http://10.0.2.2:3000$imageUrl';
                  }
                }
              }
            }
            return ProductItem.fromJson(productJson);
          }).toList();

      // Debug: print first few image URLs to verify they're absolute now
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

  Future<void> assignStylesToUser(List<int> styleIds) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$_baseUrl/user/assign-styles'),
      headers: headers,
      body: json.encode({'styleIds': styleIds}),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to assign styles: ${response.statusCode}');
    }
  }
}
