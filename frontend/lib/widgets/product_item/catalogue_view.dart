import 'package:flutter/material.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

import 'package:fynds/widgets/product_item/product_carousel.dart';

/// ─────────────────────────────────────────────────────────────────
///  1.  Fire-and-forget warm-up (no await, runs in parallel)
/// ─────────────────────────────────────────────────────────────────
Future<void> warmImages(BuildContext ctx, List<ProductItem> items) async {
  for (final product in items) {
    await precacheImage(
      CachedNetworkImageProvider(product.images.first.imageUrl),
      ctx,
    );
  }
}

/// ─────────────────────────────────────────────────────────────────
///  2.  Catalogue grid that survives tab switches
/// ─────────────────────────────────────────────────────────────────
class CatalogueView extends StatefulWidget {
  const CatalogueView({Key? key, required this.items}) : super(key: key);
  final List<ProductItem> items;

  @override
  State<CatalogueView> createState() => _CatalogueViewState();
}

/// Use AutomaticKeepAlive so the State isn’t disposed when you leave the tab
class _CatalogueViewState extends State<CatalogueView>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true; // <-- magic line

  @override
  void initState() {
    super.initState();
    // warm once – no need to await
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => warmImages(context, widget.items),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // because of keep-alive mixin

    return GridView.builder(
      key: const PageStorageKey('catalogueGrid'), // keeps scroll position too
      itemCount: widget.items.length,
      cacheExtent: 800, // prebuild rows ahead
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 3,
        crossAxisSpacing: 3,
        childAspectRatio: 1,
      ),
      itemBuilder: (_, index) {
        final item = widget.items[index];
        final imageUrl = item.images.first.imageUrl;

        return GestureDetector(
          onTap:
              () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder:
                      (_) => ProductCarouselScreen(
                        products: widget.items,
                        initialIndex: index,
                      ),
                ),
              ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: CachedNetworkImage(
              imageUrl: imageUrl,
              cacheManager: DefaultCacheManager(),
              // instant paint if already memory-cached
              placeholder: (_, __) => const SizedBox.expand(),
              fadeInDuration: Duration.zero,
              fadeOutDuration: Duration.zero,
              errorWidget: (_, __, ___) => const Icon(Icons.error),
              fit: BoxFit.cover,
              useOldImageOnUrlChange: true,
            ),
          ),
        );
      },
    );
  }
}
