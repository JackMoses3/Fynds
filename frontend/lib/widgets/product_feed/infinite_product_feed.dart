import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/product_item/item/product_item_service.dart';
import '../../models/product_item/product_item.dart';
import '../product_item/product_item.dart';
import '../../models/product_item/filter.dart';
import '../../services/auth/auth_service.dart';

class InfiniteProductFeed extends StatefulWidget {
  /// Optional initial filters for fetching products
  final FilterDto? initialFilters;

  /// NEW: If you already have a concrete list of products,
  /// you can pass them here and skip the built‐in fetch.
  final List<ProductItem>? initialProducts;

  const InfiniteProductFeed({
    Key? key,
    this.initialFilters,
    this.initialProducts,
  }) : super(key: key);

  @override
  _InfiniteProductFeedState createState() => _InfiniteProductFeedState();
}

class _InfiniteProductFeedState extends State<InfiniteProductFeed>
    with AutomaticKeepAliveClientMixin {
  static const int _lookaheadCount = 6;
  FilterDto? _filters;
  final ProductItemService _service = ProductItemService();

  final List<ProductItem> _items = [];
  bool _isLoading = false;
  bool _hasMore = true;
  final PageController _controller = PageController();

  @override
  bool get wantKeepAlive => true; // Keep state alive

  @override
  void initState() {
    super.initState();

    if (widget.initialProducts != null) {
      // use the passed‐in products and disable further loading
      _items.addAll(widget.initialProducts!);
      _hasMore = false;
    } else {
      // normal home‐screen style: fetch by filters
      _filters = widget.initialFilters;
      _loadMore();
    }
  }

  @override
  void didUpdateWidget(InfiniteProductFeed oldWidget) {
    super.didUpdateWidget(oldWidget);

    // If filters changed, reset and reload
    if (oldWidget.initialFilters != widget.initialFilters) {
      _resetAndReload();
    }
  }

  Future<void> _loadMore() async {
    if (_isLoading || !_hasMore) return;
    setState(() => _isLoading = true);

    List<ProductItem>? batch;
    try {
      // Suppose you have an AuthService that returns the current user's ID
      // or you store it in SharedPreferences or a provider.
      final userId = await AuthService().getUserId();
      // if userId is null, handle it or require login

      // Use recommended products if no filters
      batch =
          _filters != null
              ? await _service.getFilteredProductItems(_filters!)
              : userId != null
              ? await _service.getRecommendedProducts(userId)
              : [];
      // pass the user ID here
    } catch (e) {
      debugPrint('Error fetching products: $e');
      batch = [];
    }

    if (batch == null || batch.isEmpty) {
      _hasMore = false;
    } else {
      // ── PRE‐CACHE ALL IMAGES FOR EACH NEW PRODUCT ──
      for (var p in batch) {
        for (var img in p.images) {
          precacheImage(
            CachedNetworkImageProvider(
              img.imageUrl,
              headers: {"User-Agent": "Mozilla/5.0"},
            ),
            context,
          );
        }
      }
      _items.addAll(batch);
    }
    setState(() => _isLoading = false);
  }

  void _resetAndReload() {
    setState(() {
      _items.clear();
      _hasMore = true;
      _isLoading = false;
    });

    // Trigger a new load with the updated filters
    _loadMore();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for AutomaticKeepAliveClientMixin

    if (_items.isEmpty) {
      return _isLoading
          ? const Center(child: CircularProgressIndicator())
          : const Center(
            child: Text(
              'No products found',
              style: TextStyle(color: Colors.white),
            ),
          );
    }

    return PageView.builder(
      controller: _controller,
      scrollDirection: Axis.vertical,
      allowImplicitScrolling: true,
      itemCount: _hasMore ? _items.length + 1 : _items.length,
      onPageChanged: (idx) {
        // More aggressive preloading: fetch when 75% through current batch
        if (idx >= _items.length - (_lookaheadCount * 2)) {
          _loadMore();
        }

        // Early preload: fetch next batch when halfway through current batch
        if (_items.length >= 10 && idx >= (_items.length ~/ 2) && _hasMore) {
          _loadMore();
        }

        // also look‐ahead cache first image of next few
        for (int off = 1; off <= _lookaheadCount; off++) {
          final next = idx + off;
          if (next < _items.length && _items[next].images.isNotEmpty) {
            precacheImage(
              CachedNetworkImageProvider(
                _items[next].images.first.imageUrl,
                headers: {"User-Agent": "Mozilla/5.0"},
              ),
              context,
            );
          }
        }
      },
      itemBuilder: (context, idx) {
        if (idx >= _items.length) {
          return const Center(child: CircularProgressIndicator());
        }
        return ProductItemWidget(product: _items[idx]);
      },
    );
  }
}
