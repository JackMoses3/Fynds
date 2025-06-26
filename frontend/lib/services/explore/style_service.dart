import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/product_item/product_item.dart';
import '../../models/style.dart';

class StyleService {
  final Dio _dio = DioClient().client;

  Future<List<Style>?> getStyles() async {
    try {
      final response = await _dio.get('/style');
      if (response.statusCode == 200) {
        return (response.data as List)
            .map((json) => Style.fromJson(json))
            .toList();
      }
      return null;
    } catch (e) {
      print('Error fetching styles: $e');
      throw Exception('Failed to load styles');
    }
  }

  /// Fetch products by style with pagination support
  /// [styleId] - The ID of the style to filter by
  /// [page] - Page number (0-based)
  /// [limit] - Number of products per page (default: 50)
  /// [offset] - Optional offset for pagination (calculated from page if not provided)
  Future<List<ProductItem>> getProductsByStyle({
    required int styleId,
    int page = 0,
    int limit = 50,
    int? offset,
  }) async {
    try {
      final actualOffset = offset ?? (page * limit);

      final response = await _dio.get(
        '/style/$styleId/products',
        queryParameters: {'limit': limit, 'offset': actualOffset},
      );

      if (response.statusCode == 200) {
        return (response.data as List)
            .map((json) => ProductItem.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      print('Error fetching products for style $styleId: $e');
      throw Exception('Failed to load products for style');
    }
  }

  /// Fetch products by style name with pagination support
  /// [styleName] - The name of the style to filter by
  /// [page] - Page number (0-based)
  /// [limit] - Number of products per page (default: 50)
  Future<List<ProductItem>> getProductsByStyleName({
    required String styleName,
    int page = 0,
    int limit = 50,
  }) async {
    try {
      final offset = page * limit;

      final response = await _dio.get(
        '/style/name/$styleName/products',
        queryParameters: {'limit': limit, 'offset': offset},
      );

      if (response.statusCode == 200) {
        return (response.data as List)
            .map((json) => ProductItem.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      print('Error fetching products for style "$styleName": $e');
      throw Exception('Failed to load products for style');
    }
  }

  /// Get total count of products for a style (useful for pagination UI)
  Future<int> getProductCountByStyle(int styleId) async {
    try {
      final response = await _dio.get('/style/$styleId/products/count');

      if (response.statusCode == 200) {
        return response.data['count'] ?? 0;
      }
      return 0;
    } catch (e) {
      print('Error fetching product count for style $styleId: $e');
      return 0;
    }
  }
}
