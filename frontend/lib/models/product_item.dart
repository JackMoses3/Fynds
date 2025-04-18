import 'package:flutter/foundation.dart';

class ProductItem {
  final int id;
  final String name;
  final String brand;
  final String retailer;
  final double price;
  final List<String> images;

  ProductItem({
    required this.id,
    required this.name,
    required this.brand,
    required this.retailer,
    required this.price,
    required this.images,
  });

  factory ProductItem.fromJson(Map<String, dynamic> json) {
    List<String> safeImages = [];

    if (json['productImages'] != null && json['productImages'] is List) {
      for (var img in json['productImages']) {
        if (img is Map &&
            img['imageUrl'] != null &&
            img['imageUrl'] is String) {
          safeImages.add(img['imageUrl']);
        }
      }
    }

    debugPrint("✅ Safe Images extracted (${safeImages.length}): $safeImages");

    return ProductItem(
      id: json['id'],
      name: json['name'],
      brand: json['brand'] ?? '',
      retailer: json['retailer'],
      price: (json['price'] ?? 0).toDouble(),
      images: safeImages,
    );
  }
}
