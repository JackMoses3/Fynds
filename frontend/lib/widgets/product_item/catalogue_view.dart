import 'package:flutter/material.dart';
import 'package:frontend/models/product_item/product_item.dart';

import 'package:frontend/widgets/product_item/product_carousel.dart';

class CatalogueView extends StatelessWidget {
  final List<ProductItem> items;

  const CatalogueView({Key? key, required this.items}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      itemCount: items.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 3,
        crossAxisSpacing: 3,
        childAspectRatio: 1,
      ),
      itemBuilder: (context, index) {
        final item = items[index];
        final imageUrl = item.images[0].imageUrl;
        return GestureDetector(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder:
                    (_) => ProductCarouselScreen(
                      products: items,
                      initialIndex: index,
                    ),
              ),
            );
          },
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.network(imageUrl, fit: BoxFit.cover),
          ),
        );
      },
    );
  }
}
