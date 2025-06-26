import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/widgets/product_item/product_carousel.dart';

class StaggeredCatalogueView extends StatelessWidget {
  final List<ProductItem> items;
  final double spacing;

  const StaggeredCatalogueView({
    Key? key,
    required this.items,
    this.spacing = 8.0,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Center(
        child: Text(
          'No items to display',
          style: TextStyle(fontSize: 16, color: Colors.grey),
        ),
      );
    }

    return MasonryGridView.builder(
      padding: EdgeInsets.all(spacing),
      gridDelegate: SliverSimpleGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: _getCrossAxisCount(context),
      ),
      itemCount: items.length,
      mainAxisSpacing: spacing,
      crossAxisSpacing: spacing,
      itemBuilder: (context, index) {
        return _buildStaggeredItem(context, index);
      },
    );
  }

  int _getCrossAxisCount(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    if (screenWidth > 600) {
      return 4; // Tablet/Desktop
    } else if (screenWidth > 400) {
      return 3; // Large phone
    }
    return 2; // Small phone
  }

  Widget _buildStaggeredItem(BuildContext context, int index) {
    final item = items[index];
    final imageUrl = item.images.isNotEmpty ? item.images[0].imageUrl : '';

    // Create different aspect ratios for staggered effect
    final double aspectRatio = _getItemAspectRatio(index);

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder:
                (_) =>
                    ProductCarouselScreen(products: items, initialIndex: index),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              spreadRadius: 1,
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product Image
              AspectRatio(
                aspectRatio: aspectRatio,
                child: CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.cover,
                  placeholder:
                      (context, url) => Container(
                        color: Colors.grey[200],
                        child: const Center(
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                  errorWidget:
                      (context, url, error) => Container(
                        color: Colors.grey[200],
                        child: const Icon(
                          Icons.image_not_supported,
                          color: Colors.grey,
                          size: 30,
                        ),
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  double _getItemAspectRatio(int index) {
    // Create different aspect ratios to achieve staggered effect
    final patterns = [
      1.0, // Square
      0.75, // Portrait
      1.3, // Landscape
      0.9, // Slightly portrait
      1.1, // Slightly landscape
      0.8, // More portrait
    ];

    return patterns[index % patterns.length];
  }
}
