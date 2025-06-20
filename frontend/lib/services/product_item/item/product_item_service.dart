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

  /// NEW: Get personalized feed for authenticated user
  Future<List<ProductItem>?> getPersonalizedFeed({
    int? limit,
    int stage = 0,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (limit != null) queryParams['limit'] = limit;
      queryParams['stage'] = stage;

      print('🔍 Requesting personalized feed with params: $queryParams');

      final response = await _dio.get(
        'feed/personalised',
        queryParameters: queryParams,
      );

      // The response has a different structure: { batchMeta: {...}, products: [...] }
      final Map<String, dynamic> data = response.data;
      final List products = data['products'] ?? [];

      print('✅ Received ${products.length} products from personalized feed');

      return products.map((json) => ProductItem.fromJson(json)).toList();
    } catch (e) {
      print('❌ Error fetching personalized feed: $e');
      if (e is DioException) {
        print('📊 Response status: ${e.response?.statusCode}');
        print('📊 Response data: ${e.response?.data}');
      }
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
}
