import 'package:flutter/material.dart';
import 'package:fynds/models/basket_item.dart';
import 'package:fynds/services/basket/basket_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';

class BasketScreen extends StatefulWidget {
  const BasketScreen({Key? key}) : super(key: key);

  @override
  _BasketScreenState createState() => _BasketScreenState();
}

class _BasketScreenState extends State<BasketScreen> {
  final _basketService = BasketService();
  bool _loading = true;
  List<BasketItem> _items = []; //stores items retrieved from backend

  @override
  void initState() {
    super.initState();
    _loadBasket();
  }

  Future<void> _loadBasket() async {
    try {
      final items = await _basketService.fetchBasket();
      setState(() => _items = items);
    } catch (e) {
      debugPrint('Error loading basket: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  /// Groups the current items by their retailer string.
  Map<String, List<BasketItem>> _groupByRetailer() {
    final map = <String, List<BasketItem>>{};
    for (final item in _items) {
      map.putIfAbsent(item.product.retailer, () => []).add(item);
    }
    return map;
  }

  /// Opens a URL in the browser
  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      debugPrint('Could not open link: $url');
    }
  }

  /// Remove a single item from both UI and backend
  Future<void> _removeItem(BasketItem item) async {
    await _basketService.removeFromBasket(item.product.id);
    // remove locally and rebuild
    setState(() {
      _items.remove(item);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_items.isEmpty) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Text(
            'Your basket is empty',
            style: TextStyle(color: Colors.white54, fontSize: 16),
          ),
        ),
      );
    }

    final grouped = _groupByRetailer();

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text(
          'Your Basket - Tap to Buy',
          style: TextStyle(color: Colors.white),
        ),
      ),

      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final retailer in grouped.keys) ...[
            // ── Retailer Header ─────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                retailer,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),

            // ── All items for this retailer ──────────────
            for (final item in grouped[retailer]!) ...[
              _buildItemRow(item),
              const SizedBox(height: 16),
            ],

            const Divider(color: Colors.white24),
          ],
        ],
      ),
    );
  }

  Widget _buildItemRow(BasketItem item) {
    final p = item.product;
    return GestureDetector(
      onTap: () => _openUrl(p.url),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: CachedNetworkImage(
              imageUrl: p.images.isNotEmpty ? p.images.first.imageUrl : '',
              width: 100,
              height: 100,
              fit: BoxFit.cover,
              httpHeaders: {"User-Agent": "Mozilla/5.0"},
              placeholder:
                  (_, __) => Container(
                    width: 100,
                    height: 100,
                    color: Colors.white12,
                    child: const Center(
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                  ),
              errorWidget:
                  (_, __, ___) => Container(
                    width: 100,
                    height: 100,
                    color: Colors.white12,
                    child: const Icon(Icons.broken_image, color: Colors.red),
                  ),
            ),
          ),

          const SizedBox(width: 16),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  p.retailer,
                  style: const TextStyle(color: Colors.white60, fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  '\$${p.price.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          // Remove button
          IconButton(
            onPressed: () => _removeItem(item),
            icon: const Icon(Icons.close, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
