import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';

class ViewingService {
  final Dio _dio = DioClient().client;

  /// Record product viewing metrics
  Future<void> recordViewing({
    required int productId,
    required int scrollLengthSeconds,
    required int scrollDepth,
  }) async {
    try {
      await _dio.post(
        '/viewing-history',
        data: {
          'productId': productId,
          'scrollLength': scrollLengthSeconds,
          'scrollDepth': scrollDepth,
        },
      );
      print(
        '✅ Viewing metrics saved for product $productId: '
        '$scrollLengthSeconds sec, $scrollDepth swipes',
      );
    } catch (e) {
      print('❌ Failed to save viewing metrics: $e');
    }
  }
}
