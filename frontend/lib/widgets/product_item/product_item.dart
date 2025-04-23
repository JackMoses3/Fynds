import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:frontend/models/product_item/product_item.dart';

typedef FilterCallback = Future<void> Function();

class ProductItemWidget extends StatefulWidget {
  final ProductItem product;

  const ProductItemWidget({Key? key, required this.product}) : super(key: key);

  @override
  _ProductItemWidgetState createState() => _ProductItemWidgetState();
}

class _ProductItemWidgetState extends State<ProductItemWidget>
    with SingleTickerProviderStateMixin {
  bool _isLiked = false;
  bool _isSaved = false;
  bool _isInBasket = false;
  int _currentImage = 0;
  late PageController _pageController;
  late AnimationController _basketController;
  late Animation<double> _basketAnimation;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _basketController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _basketAnimation = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(
        parent: _basketController,
        curve: Curves.easeOut,
        reverseCurve: Curves.easeIn,
      ),
    )..addStatusListener((status) {
      if (status == AnimationStatus.completed) _basketController.reverse();
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    _basketController.dispose();
    super.dispose();
  }

  Widget _buildDots() {
    final count = widget.product.images.length;
    print(count);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (i) {
        final isActive = i == _currentImage;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 12 : 8,
          height: isActive ? 12 : 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive ? Colors.white : Colors.white54,
            border: Border.all(color: Colors.black),
          ),
        );
      }),
    );
  }

  Widget _actionIcon(
    IconData icon,
    VoidCallback onTap, {
    Color color = Colors.white,
  }) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Icon(icon, size: 36, color: Colors.black),
        IconButton(icon: Icon(icon), color: color, onPressed: onTap),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    debugPrint('🛠️ ProductItem type: ${p.runtimeType}');
    for (var url in p.images) {
      debugPrint('👉 Image URL: $url');
    }
    return GestureDetector(
      behavior: HitTestBehavior.deferToChild,
      onDoubleTap: () {
        setState(() {
          _isLiked = true;
        });
      },
      child: Stack(
        children: [
          // Horizontal swipe
          PageView.builder(
            key: ValueKey(p.id),
            controller: _pageController,
            scrollDirection: Axis.horizontal,
            itemCount: p.images.length,
            onPageChanged: (i) => setState(() => _currentImage = i),
            itemBuilder:
                (_, i) => Image(
                  image: CachedNetworkImageProvider(
                    p.images[i].imageUrl,
                    headers: {"User-Agent": "Mozilla/5.0"},
                  ),
                  fit: BoxFit.cover,
                  width: double.infinity,
                  gaplessPlayback: true,
                ),
          ),

          // Dots
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 160),
              child: _buildDots(),
            ),
          ),

          // Info panel
          Positioned(
            bottom: 20,
            left: 20,
            right: 100,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    p.retailer,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(p.name, style: const TextStyle(color: Colors.white)),
                  Text(p.brand, style: const TextStyle(color: Colors.white)),
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
          ),

          // Action icons
          Positioned(
            right: 12,
            bottom: MediaQuery.of(context).size.height * 0.25,
            child: Column(
              children: [
                _actionIcon(
                  Icons.favorite,
                  () => setState(() => _isLiked = !_isLiked),
                  color: _isLiked ? Colors.red : Colors.white,
                ),
                const SizedBox(height: 24),
                _actionIcon(
                  Icons.bookmark,
                  () => setState(() => _isSaved = !_isSaved),
                  color: _isSaved ? Colors.red : Colors.white,
                ),
                const SizedBox(height: 24),
                ScaleTransition(
                  scale: _basketAnimation,
                  child: _actionIcon(
                    Icons.shopping_bag,
                    () {
                      setState(() => _isInBasket = !_isInBasket);
                      _basketController.forward();
                    },
                    color: _isInBasket ? Colors.red : Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
