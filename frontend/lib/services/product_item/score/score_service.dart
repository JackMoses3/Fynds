import 'package:dio/dio.dart';

class ScoreService {
  final Dio _dio = Dio();

  Future<void> addScore({
    required int userId,
    required int productItemId,
    required Map<String, dynamic> signals,
  }) async {
    final url =
        'http://10.0.2.2:3000/api/product-item/add-score'; // <-- updated endpoint

    try {
      await _dio.post(
        url,
        data: {
          'userId': userId,
          'productItemId': productItemId,
          'signals': signals,
        },
        // Add headers if you need authentication
      );
    } catch (e) {
      print('Failed to send score: $e');
    }
  }
}
