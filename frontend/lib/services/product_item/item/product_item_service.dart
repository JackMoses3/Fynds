import 'package:dio/dio.dart';
import 'package:frontend/core/dio_client.dart';
import 'package:frontend/models/product_item/product_item.dart';
import 'package:frontend/models/product_item/filter.dart';

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
      final response = await _dio.post(
        'product-item/filtered',
        data: filters.toJson(),
      );
      final List data = response.data;
      return data.map((json) => ProductItem.fromJson(json)).toList();
    } catch (e) {
      print('Error fetching filtered product items: $e');
      return null;
    }
  }
}
