import 'dart:convert';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class OnboardingService {
  static const String _baseUrl =
      'http://10.0.2.2:3000/api'; // on Android emulator

  Future<Map<String, String>> _getHeaders() async {
    final token = await const FlutterSecureStorage().read(key: 'access_token');
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Get products for multiple selected styles with discovery products
  Future<List<ProductItem>> getStyleProducts({
    required List<int> selectedStyleIds, // ✅ Changed to List<int>
    required String clothingPreference,
    int limit = 50, // ✅ Default to 50
  }) async {
    // Join style IDs with commas
    final styleIdsParam = selectedStyleIds.join(',');
    final url =
        '$_baseUrl/onboarding/style-products'
        '?styleIds=$styleIdsParam'
        '&clothingPreference=$clothingPreference'
        '&limit=$limit';

    // debug: print URL
    print('🐞 [OnboardingService] GET $url');
    final response = await http.get(
      Uri.parse(url),
      headers: await _getHeaders(),
    );
    // debug: print status & body
    print('🐞 [OnboardingService] status: ${response.statusCode}');
    print('🐞 [OnboardingService] body: ${response.body}');

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((e) => ProductItem.fromJson(e)).toList();
    } else {
      throw Exception('Failed to load style products: ${response.statusCode}');
    }
  }

  /// Save user's onboarding product selections
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
