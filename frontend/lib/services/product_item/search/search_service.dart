import 'package:dio/dio.dart';
import 'package:frontend/core/dio_client.dart';
import 'package:frontend/models/product_item/search.dart';

class SearchService {
  final Dio _dio = DioClient().client;

  /// Sends [query] to ML text to image search endpoint
  /// and returns a list of SearchMatch (productId + distance).
  Future<List<SearchMatch>?> searchMatches(String query) async {
    try {
      final response = await _dio.post(
        // Full URL overrides Dio’s baseUrl
        'http://10.0.2.2:8000/product-item/search',
        data: {'query': query},
      );
      final List data = response.data as List;
      return data
          .map((json) => SearchMatch.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error performing search: $e');
      return null;
    }
  }
}
