import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

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
  final String url;
  final List<ProductImage> images;

  ProductItem({
    required this.id,
    required this.name,
    required this.brand,
    required this.retailer,
    required this.price,
    required this.url,
    required this.images,
  });

  factory ProductItem.fromJson(Map<String, dynamic> json) {
    final rawImages = json['images'];
    final imgs = <ProductImage>[];
    if (rawImages is List) {
      for (final e in rawImages) {
        if (e is Map<String, dynamic>) {
          imgs.add(ProductImage.fromJson(e));
        }
      }
    }
    debugPrint('✅ Parsed ${imgs.length} images for product ${json['id']}');

    return ProductItem(
      id: json['id'] as int,
      name: (json['name'] as String?) ?? '',
      brand: (json['brand'] as String?) ?? '',
      retailer: (json['retailer'] as String?) ?? '',
      price: (json['price'] as num).toDouble(),
      url: (json['url'] as String?) ?? '',
      images: imgs,
    );
  }
}

class LikeService {
  Future<List<ProductItem>> getLikedProducts() async {
    // Mocked network request
    await Future.delayed(const Duration(seconds: 2));
    return [];
  }
}

class CatalogueView extends StatelessWidget {
  final List<ProductItem> items;

  const CatalogueView({Key? key, required this.items}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return ListTile(title: Text(item.name), subtitle: Text(item.brand));
      },
    );
  }
}

class LikedProductsPage extends StatelessWidget {
  const LikedProductsPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Liked Products')),
      body: FutureBuilder<List<ProductItem>>(
        future: LikeService().getLikedProducts(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Text('Failed to load liked items.'),
              ),
            );
          } else {
            // Filter out products with no images
            final items =
                (snapshot.data ?? []).where((p) => p.images.isNotEmpty).toList()
                  ..sort(
                    (a, b) => b.id.compareTo(a.id),
                  ); // Sort descending by id
            if (items.isEmpty) {
              return const Center(child: Text('No liked items.'));
            }
            return CatalogueView(items: items);
          }
        },
      ),
    );
  }
}
