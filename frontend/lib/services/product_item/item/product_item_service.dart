import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/models/product_item/filter.dart';

class ProductItemService {
  final Dio _dio = DioClient().client;

  Future<List<ProductItem>?> getProductItems() async {
    try {
      final response = await _dio.get('product-item');
      final List data = response.data;
      return data.map((json) => ProductItem.fromJson(json)).toList();
    } catch (e) {
      print('Error fetching product items: $e');
      return null;
    }
  }

  Future<List<ProductItem>?> getFilteredProductItems(FilterDto filters) async {
    try {
      final payload = <String, dynamic>{};
      if (filters.categories != null) payload['category'] = filters.categories;
      if (filters.brands != null) payload['brand'] = filters.brands;
      if (filters.retailers != null) payload['retailer'] = filters.retailers;
      if (filters.minPrice != null) payload['minPrice'] = filters.minPrice;
      if (filters.maxPrice != null) payload['maxPrice'] = filters.maxPrice;

      final response = await _dio.post('product-item/filtered', data: payload);
      final List data = response.data;
      return data.map((json) => ProductItem.fromJson(json)).toList();
    } catch (e) {
      print('Error fetching filtered product items: $e');
      return null;
    }
  }

  /// NEW: batch‐fetch N products by ID
  Future<List<ProductItem>?> getProductItemsByIds(List<int> ids) async {
    try {
      final response = await _dio.post(
        'product-item/batch',
        data: {'ids': ids},
      );
      final List data = response.data as List;
      return data
          .map((json) => ProductItem.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error fetching products by IDs: $e');
      return null;
    }
  }

  /// NEW: fetch recommended products for the user
  Future<List<ProductItem>?> getRecommendedProducts(int userId) async {
    try {
      final url = 'http://10.0.2.2:3000/api/product-item/recommended';
      final response = await _dio.get(
        url,
        options: Options(
          headers: {'Authorization': 'Bearer ${authTokenFor(userId)}'},
        ),
      );
      final List data = response.data;
      return data.map((json) => ProductItem.fromJson(json)).toList();
    } catch (e) {
      print('Error fetching recommended products: $e');
      return null;
    }
  }

  // If you have a function to get the token for a user
  String authTokenFor(int userId) {
    // implement your logic or store token in SharedPreferences
    return 'YourJWTToken';
  }
}
