import 'package:fynds/models/product_item/product_item.dart';

class BasketItem {
  final ProductItem product;
  final int quantity;

  BasketItem({required this.product, required this.quantity});
}
