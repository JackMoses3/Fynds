import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/product_item/product_item.dart';

class LikeService {
  final Dio _dio = DioClient().client;

  Future<List<int>> getLikedProductIds() async {
    final resp = await _dio.get('like');
    return List<int>.from(resp.data);
  }

  Future<void> likeProduct(int productId) async {
    await _dio.post('like/$productId');
  }

  Future<void> unlikeProduct(int productId) async {
    await _dio.delete('like/$productId');
  }

  Future<List<ProductItem>> getLikedProducts() async {
    try {
      final ids = await getLikedProductIds();
      if (ids.isEmpty) return [];
      final resp = await _dio.post('/product-item/bulk', data: {'ids': ids});
      return (resp.data as List)
          .map((json) => ProductItem.fromJson(json))
          .toList();
    } catch (e, stack) {
      print('❌ Error in getLikedProducts: $e');
      print(stack);
      rethrow;
    }
  }
}
