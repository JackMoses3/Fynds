// lib/services/product_item/search/search_service.dart

import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';

/// Note: We assume your DioClient is already configured to talk to localhost:3000
/// (NestJS), e.g. baseUrl="http://10.0.2.2:3000" for Android emulator.
class SearchService {
  final Dio _dio = DioClient().client;

  /// POSTs { "text": query } to
  ///   http://<your-nest-host>/api/embedding/generate-text-input-embedding
  /// Expects a JSON response { "embedding": [512 floats] }
  /// Returns List<double> of length=512, or throws on error.
  Future<List<double>> getTextEmbedding(String query) async {
    try {
      final response = await _dio.post(
        '/embedding/generate-text-input-embedding',
        data: {'text': query},
      );

      // The backend returns { "embedding": [ …512 floats… ] }
      if (response.statusCode == 200 ||
          response.statusCode == 201 && response.data != null) {
        final Map<String, dynamic> payload =
            response.data as Map<String, dynamic>;

        // Extract “embedding” key
        final List<dynamic> rawList = payload['embedding'] as List<dynamic>;
        // Cast to List<double>
        return rawList
            .map((e) => (e as num).toDouble())
            .toList(growable: false);
      } else {
        throw Exception(
          'Unexpected response [${response.statusCode}]: ${response.data}',
        );
      }
    } catch (e) {
      print('Error in getTextEmbedding: $e');
      rethrow;
    }
  }
}
