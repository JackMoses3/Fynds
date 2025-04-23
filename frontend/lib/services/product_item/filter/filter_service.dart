import 'package:dio/dio.dart';
import 'package:frontend/core/dio_client.dart';
import 'package:frontend/models/product_item/filter.dart';

class FilterService {
  final Dio _dio = DioClient().client;

  Future<BrandPerCatRet?> getBrandsPerCatRet(
    List<String> category,
    List<String> retailer,
  ) async {
    try {
      final response = await _dio.post(
        'product-item/brands',
        data: {'category': category, 'retailer': retailer},
      );
      return BrandPerCatRet.fromJson(response.data);
    } catch (e) {
      print('Error fetching brands per category: $e');
      return null;
    }
  }

  Future<CategoryPerBraRet?> getCategoriesPerBraRet(
    List<String> brand,
    List<String> retailer,
  ) async {
    try {
      final response = await _dio.post(
        'product-item/categories',
        data: {'brand': brand, 'retailer': retailer},
      );
      return CategoryPerBraRet.fromJson(response.data);
    } catch (e) {
      print('Error fetching categories per brand: $e');
      return null;
    }
  }

  Future<RetailerPerBraCat?> getRetailersPerBraCat(
    List<String> brand,
    List<String> category,
  ) async {
    try {
      final response = await _dio.post(
        'product-item/retailers',
        data: {'brand': brand, 'category': category},
      );
      return RetailerPerBraCat.fromJson(response.data);
    } catch (e) {
      print('Error fetching retailers per brand and category: $e');
      return null;
    }
  }
}
