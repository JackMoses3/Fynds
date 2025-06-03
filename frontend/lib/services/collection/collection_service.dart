import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/collection.dart';
import 'package:fynds/models/product_item/product_item.dart';

class CollectionService {
  final Dio _dio = DioClient().client;

  Future<List<CollectionList>?> getCollections() async {
    try {
      final response = await _dio.get('collection');
      final List data = response.data;
      return data.map((item) => CollectionList.fromJson(item)).toList();
    } catch (e) {
      print('Error fetching collection: $e');
      return null;
    }
  }

  Future<CollectionList?> createNewCollection(String name) async {
    try {
      print('📝 Creating collection with name: $name');
      final response = await _dio.post(
        'collection',
        data: {'name': name},
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      return response.data != null
          ? CollectionList.fromJson(response.data)
          : CollectionList(id: 0, name: '');
    } catch (e) {
      print('Error creating new collection: $e');
      return null;
    }
  }

  Future<List<ProductItem>> getCollectionById(int id) async {
    try {
      print('📤 Sending request to get collection items...');
      final response = await _dio.get('collection/$id');
      final List data = response.data;
      return data.map((item) => ProductItem.fromJson(item)).toList();
    } catch (e) {
      print('❌ Error loading collection items: $e');
      if (e is DioException) {
        print('⛔ DioException type: ${e.type}');
        print('⛔ Status code: ${e.response?.statusCode}');
        print('⛔ Response data: ${e.response?.data}');
      }
      return [];
    }
  }
}
