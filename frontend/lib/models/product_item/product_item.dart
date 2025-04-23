import 'package:flutter/foundation.dart';

class ProductItem {
  final int id;
  final String name;
  final String brand;
  final String retailer;
  final double price;
  final List<ProductImages> images;

  ProductItem({
    required this.id,
    required this.name,
    required this.brand,
    required this.retailer,
    required this.price,
    required this.images,
  });

  factory ProductItem.fromJson(Map<String, dynamic> json) {
    List<ProductImages> safeImages = [];

    if (json['images'] != null && json['images'] is List) {
      for (var image in json['images']) {
        if (image is Map) {
          safeImages.add(ProductImages.fromJson(image.cast<String, dynamic>()));
        }
      }
    }
    debugPrint("✅ Safe Images extracted (${safeImages.length}): $safeImages");
    return ProductItem(
      id: json['id'],
      name: json['name'],
      brand: json['brand'],
      retailer: json['retailer'],
      price: (json['price'] as num).toDouble(),
      images: safeImages,
    );
  }
}

class ProductItemList {
  final List<ProductItem> products;

  ProductItemList({required this.products});

  factory ProductItemList.fromJson(Map<String, dynamic> json) {
    List<ProductItem> safeProducts = [];

    if (json['products'] != null && json['products'] is List) {
      for (var product in json['products']) {
        if (product is Map) {
          safeProducts.add(
            ProductItem.fromJson(product.cast<String, dynamic>()),
          );
        }
      }
    }

    debugPrint(
      "✅ Safe Products extracted (${safeProducts.length}): $safeProducts",
    );

    return ProductItemList(products: safeProducts);
  }
}

class ProductImages {
  final int id;
  final String imageUrl;

  ProductImages({required this.id, required this.imageUrl});

  factory ProductImages.fromJson(Map<String, dynamic> json) {
    return ProductImages(id: json['id'], imageUrl: json['imageUrl'] ?? '');
  }
}
