import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/basket_item.dart';
import 'package:fynds/models/product_item/product_item.dart';

class BasketService {
  final Dio _dio = DioClient().client;

  /// Fetch the user's trolley, parse out nested items
  Future<List<BasketItem>> fetchBasket() async {
    final resp = await _dio.get('shopping-trolley');
    // resp.data is expected to be { id: number, items: [ { product: {...}, quantity: N }, ... ] }
    final rawItems = resp.data['items'] as List<dynamic>;
    return rawItems.map((raw) {
      final productJson = raw['product'] as Map<String, dynamic>;
      final qty = raw['quantity'] as int;
      return BasketItem(
        product: ProductItem.fromJson(productJson),
        quantity: qty,
      );
    }).toList();
  }

  Future<void> addToBasket(int productId, [int qty = 1]) => _dio.post(
    'shopping-trolley/items',
    data: {'productId': productId, 'quantity': qty},
  );

  Future<void> updateQuantity(int productId, int qty) =>
      _dio.patch('shopping-trolley/items/$productId', data: {'quantity': qty});

  Future<void> removeFromBasket(int productId) =>
      _dio.delete('shopping-trolley/items/$productId');
}
