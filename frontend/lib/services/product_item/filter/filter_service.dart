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
      // wrap raw List into Map so fromJson can pick it up:
      final wrapped = {'brands': response.data};
      return BrandPerCatRet.fromJson(wrapped);
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
      // wrap raw List into Map so fromJson can pick it up:
      final wrapped = {'categories': response.data};
      return CategoryPerBraRet.fromJson(wrapped);
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
      // wrap raw List into Map so fromJson can pick it up:
      final wrapped = {'retailers': response.data};
      return RetailerPerBraCat.fromJson(wrapped);
    } catch (e) {
      print('Error fetching retailers per brand and category: $e');
      return null;
    }
  }
}
