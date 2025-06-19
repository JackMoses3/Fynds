import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/models/product_item/filter.dart';

class SearchService {
  final Dio _dio = DioClient().client;
  static const String _recentSearchesKey = 'recent_searches';

  /// Search products by text query using the existing search-text endpoint
  Future<List<ProductItem>> searchProductsByText(
    String query, {
    FilterDto? filters,
  }) async {
    try {
      print(
        '🔍 [SearchService] ==================== SEARCH START ====================',
      );
      print('🔍 [SearchService] Searching products for: "$query"');
      print('🔍 [SearchService] Base URL: ${_dio.options.baseUrl}');

      final payload = <String, dynamic>{
        'query': query, // Your endpoint expects 'query', not 'text'
      };

      if (filters != null) {
        payload['filters'] = filters.toJson();
        print('🔍 [SearchService] Filters applied: ${filters.toJson()}');
      }

      print(
        '🔍 [SearchService] Full endpoint URL: ${_dio.options.baseUrl}/embedding-qdrant/search-text',
      );
      print('🔍 [SearchService] Sending payload: $payload');
      print('🔍 [SearchService] Request headers: ${_dio.options.headers}');

      final response = await _dio.post(
        '/embedding-qdrant/search-text',
        data: payload,
      );

      print('✅ [SearchService] Search response status: ${response.statusCode}');
      print('✅ [SearchService] Response headers: ${response.headers.map}');
      print(
        '✅ [SearchService] Response data type: ${response.data.runtimeType}',
      );
      print('✅ [SearchService] Found ${response.data?.length ?? 0} products');

      if (response.statusCode == 200 || response.statusCode == 201) {
        final List<dynamic> data = response.data as List<dynamic>;
        final products =
            data.map((json) => ProductItem.fromJson(json)).toList();

        print(
          '✅ [SearchService] Parsed ${products.length} products successfully',
        );
        print(
          '🔍 [SearchService] ==================== SEARCH SUCCESS ====================',
        );
        return products;
      } else {
        throw Exception(
          'Search failed [${response.statusCode}]: ${response.data}',
        );
      }
    } catch (e) {
      print(
        '❌ [SearchService] ==================== SEARCH ERROR ====================',
      );
      print('❌ [SearchService] Error searching products: $e');
      if (e is DioException) {
        print('❌ [SearchService] DioException details:');
        print('   Status code: ${e.response?.statusCode}');
        print('   Status message: ${e.response?.statusMessage}');
        print('   Request method: ${e.requestOptions.method}');
        print('   Request URI: ${e.requestOptions.uri}');
        print('   Request path: ${e.requestOptions.path}');
        print('   Request data: ${e.requestOptions.data}');
        print('   Request headers: ${e.requestOptions.headers}');
        print('   Response data: ${e.response?.data}');
        print('   Response headers: ${e.response?.headers?.map}');
      }
      print(
        '❌ [SearchService] ==================== SEARCH ERROR END ====================',
      );
      rethrow;
    }
  }

  Future<List<String>> getRecentSearches() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final searches = prefs.getStringList(_recentSearchesKey) ?? [];
      return searches;
    } catch (e) {
      print('❌ [SearchService] Error getting recent searches: $e');
      return [];
    }
  }

  Future<void> saveSearchTerm(String term) async {
    try {
      if (term.trim().isEmpty) return;

      final prefs = await SharedPreferences.getInstance();
      final searches = prefs.getStringList(_recentSearchesKey) ?? [];

      searches.remove(term);
      searches.insert(0, term);

      if (searches.length > 10) {
        searches.removeRange(10, searches.length);
      }

      await prefs.setStringList(_recentSearchesKey, searches);
      print('✅ [SearchService] Saved search term: "$term"');
    } catch (e) {
      print('❌ [SearchService] Error saving search term: $e');
    }
  }

  Future<void> removeSearchTerm(String term) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final searches = prefs.getStringList(_recentSearchesKey) ?? [];

      searches.remove(term);
      await prefs.setStringList(_recentSearchesKey, searches);
      print('✅ [SearchService] Removed search term: "$term"');
    } catch (e) {
      print('❌ [SearchService] Error removing search term: $e');
    }
  }

  Future<void> clearRecentSearches() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_recentSearchesKey);
      print('✅ [SearchService] Cleared all recent searches');
    } catch (e) {
      print('❌ [SearchService] Error clearing recent searches: $e');
    }
  }
}
