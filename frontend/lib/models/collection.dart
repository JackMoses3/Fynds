import 'product_item/product_item.dart';

class Collection {
  final int id;
  final String name;
  final int userId;
  final List<CollectionItem>? items;

  Collection({
    required this.id,
    required this.name,
    required this.userId,
    this.items,
  });

  factory Collection.fromJson(Map<String, dynamic> json) {
    return Collection(
      id: json['id'] as int,
      name: json['name'] as String,
      userId: json['userId'] as int,
      items:
          json['items'] != null
              ? (json['items'] as List)
                  .map((e) => CollectionItem.fromJson(e))
                  .toList()
              : null,
    );
  }
}

class CollectionItem {
  final int id;
  final int collectionId;
  final int productItemId;
  final ProductItem product;

  CollectionItem({
    required this.id,
    required this.collectionId,
    required this.productItemId,
    required this.product,
  });

  factory CollectionItem.fromJson(Map<String, dynamic> json) {
    return CollectionItem(
      id: json['id'] as int,
      collectionId: json['collectionId'] as int,
      productItemId: json['productItemId'] as int,
      product: ProductItem.fromJson(json['product'] as Map<String, dynamic>),
    );
  }
}

class CollectionList {
  final int id;
  final String name;

  CollectionList({required this.id, required this.name});
  factory CollectionList.fromJson(Map<String, dynamic> json) {
    return CollectionList(id: json['id'] as int, name: json['name'] as String);
  }
}
