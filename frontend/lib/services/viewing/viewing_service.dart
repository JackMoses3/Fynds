import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';

class ViewingService {
  final Dio _dio = DioClient().client;

  /// Record product viewing metrics
  Future<void> recordViewing({
    required int productId,
    required int scrollLength, // Number of horizontal swipes
    required double scrollDepth, // % of horizontal swipes (0-100)
    required double scrollTime, // Time spent on product (seconds)
  }) async {
    try {
      await _dio.post(
        '/viewing-history',
        data: {
          'productId': productId,
          'scrollLength': scrollLength,
          'scrollDepth': scrollDepth,
          'scrollTime': scrollTime,
        },
      );
      print(
        '✅ Viewing metrics saved for product $productId: '
        '$scrollLength swipes, $scrollDepth%, $scrollTime sec',
      );
    } catch (e) {
      print('❌ Failed to save viewing metrics: $e');
    }
  }
}
