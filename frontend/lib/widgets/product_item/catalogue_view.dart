import 'package:flutter/material.dart';
import 'package:frontend/models/collection.dart';

class CatalogueView extends StatelessWidget {
  final List<CollectionItem> items;

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
        final imageUrl = item.product.images[0].imageUrl;
        return ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(imageUrl, fit: BoxFit.cover),
        );
      },
    );
  }
}
