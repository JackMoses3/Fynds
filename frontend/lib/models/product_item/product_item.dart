import 'package:flutter/foundation.dart';

/// Single image record
class ProductImage {
  final int id;
  final String imageUrl;

  ProductImage({required this.id, required this.imageUrl});

  factory ProductImage.fromJson(Map<String, dynamic> json) {
    return ProductImage(
      id: json['id'] as int,
      imageUrl: (json['imageUrl'] as String?) ?? '',
    );
  }
}

/// Main product record
class ProductItem {
  final int id;
  final String name;
  final String brand;
  final String retailer;
  final double price;
  final String url; // ← New field
  final List<ProductImage> images;

  ProductItem({
    required this.id,
    required this.name,
    required this.brand,
    required this.retailer,
    required this.price,
    required this.url, // ← New param
    required this.images,
  });

  factory ProductItem.fromJson(Map<String, dynamic> json) {
    // Parse images array
    final rawImages = json['images'];
    final imgs = <ProductImage>[];
    if (rawImages is List) {
      for (final e in rawImages) {
        if (e is Map<String, dynamic>) {
          imgs.add(ProductImage.fromJson(e));
        }
      }
    }
    // Debug log
    debugPrint('✅ Parsed ${imgs.length} images for product ${json['id']}');

    return ProductItem(
      id: json['id'] as int,
      name: (json['name'] as String?) ?? '',
      brand: (json['brand'] as String?) ?? '',
      retailer: (json['retailer'] as String?) ?? '',
      price: (json['price'] as num).toDouble(),
      url: (json['url'] as String?) ?? '', // ← Parse URL
      images: imgs,
    );
  }
}
