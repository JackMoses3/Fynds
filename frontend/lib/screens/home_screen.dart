import 'dart:convert';
import 'package:flutter/material.dart';
import 'preferences_screen.dart';
import 'package:http/http.dart' as http;
import '../models/product_item.dart';
import 'package:cached_network_image/cached_network_image.dart';

class HomeScreen extends StatefulWidget {
  final Map<String, dynamic>? initialFilters;
  const HomeScreen({Key? key, this.initialFilters}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  final List<ProductItem> _productHistory = [];
  int _currentProductIndex = -1;
  Map<String, dynamic>? filters;

  bool isLiked = false, isSaved = false, isInBasket = false;
  int _currentImageIndex = 0;

  Offset? _doubleTapPosition;
  bool _showHeart = false;

  late final AnimationController _basketController;
  late final Animation<double> _scaleAnimation;
  final PageController _verticalController = PageController();

  static const int _lookahead = 6;
  int _inFlightFetches = 0;

  @override
  void initState() {
    super.initState();
    filters = widget.initialFilters;

    _basketController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(
        parent: _basketController,
        curve: Curves.easeOut,
        reverseCurve: Curves.easeIn,
      ),
    );

    _fetchOne().then((_) {
      for (int i = 1; i < _lookahead; i++) {
        _startFetch();
      }
    });
  }

  void _startFetch() {
    if (_inFlightFetches >= _lookahead) return;
    _inFlightFetches++;
    _fetchOne().whenComplete(() => _inFlightFetches--);
  }

  Future<void> _fetchOne() async {
    final ctx = context;
    ProductItem? candidate;

    try {
      final useFilters = filters != null && filters!.isNotEmpty;
      final uri =
          useFilters
              ? Uri.parse(
                'http://10.0.2.2:3000/api/product-item/random-with-filters',
              )
              : Uri.parse('http://10.0.2.2:3000/api/product-item/random');

      final response =
          useFilters
              ? await http.post(
                uri,
                headers: {'Content-Type': 'application/json'},
                body: jsonEncode({
                  'brand': filters!['brands'],
                  'retailer': filters!['retailers'],
                  'category': filters!['categories'],
                  'minPrice': filters!['minPrice'],
                  'maxPrice': filters!['maxPrice'],
                }),
              )
              : await http.get(uri);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final map = jsonDecode(response.body) as Map<String, dynamic>;
        final p = ProductItem.fromJson(map);
        if (p.images.isNotEmpty) {
          final provider = CachedNetworkImageProvider(
            p.images[0],
            headers: {"User-Agent": "Mozilla/5.0"},
          );
          await precacheImage(provider, ctx);
          candidate = p;
        }
      }
    } catch (e) {
      debugPrint('❌ Error fetching product: $e');
    }

    if (!mounted || candidate == null) return;
    setState(() {
      _productHistory.add(candidate!);
      if (_currentProductIndex == -1) {
        _currentProductIndex = 0;
        _resetState();
      }
    });

    for (var url in candidate.images.skip(1)) {
      final provider = CachedNetworkImageProvider(
        url,
        headers: {"User-Agent": "Mozilla/5.0"},
      );
      precacheImage(provider, ctx);
    }
  }

  void _resetState() {
    isLiked = false;
    isSaved = false;
    isInBasket = false;
    _currentImageIndex = 0;
  }

  void _toggleBasket() {
    setState(() => isInBasket = !isInBasket);
    _basketController.forward().then((_) => _basketController.reverse());
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(isInBasket ? 'Added to basket' : 'Removed from basket'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  List<Widget> _buildDots(int count, int active) {
    final total = count > 5 ? 5 : count;
    int start = 0;
    if (count > 5) {
      if (active <= 2)
        start = 0;
      else if (active >= count - 3)
        start = count - 5;
      else
        start = active - 2;
    }
    return List.generate(total, (i) {
      final idx = start + i;
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: idx == active ? Colors.white : Colors.white54,
          border: Border.all(color: Colors.black),
        ),
      );
    });
  }

  void _onDoubleTap(TapDownDetails details) {
    setState(() {
      isLiked = true;
      _doubleTapPosition = details.globalPosition;
      _showHeart = true;
    });

    Future.delayed(const Duration(milliseconds: 800), () {
      if (mounted) {
        setState(() {
          _showHeart = false;
        });
      }
    });
  }

  Widget _outlinedIcon({
    required IconData icon,
    required VoidCallback onPressed,
    Color iconColor = Colors.white,
    double iconSize = 30,
    double outlineWidth = 2,
    Color outlineColor = Colors.black,
  }) => Stack(
    alignment: Alignment.center,
    children: [
      Icon(icon, size: iconSize + outlineWidth * 2, color: outlineColor),
      IconButton(
        icon: Icon(icon),
        iconSize: iconSize,
        color: iconColor,
        onPressed: onPressed,
        splashRadius: iconSize,
      ),
    ],
  );

  @override
  void dispose() {
    _basketController.dispose();
    _verticalController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body:
          _productHistory.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : PageView.builder(
                controller: _verticalController,
                scrollDirection: Axis.vertical,
                allowImplicitScrolling: true,
                itemCount: _productHistory.length,
                onPageChanged: (vidx) {
                  setState(() {
                    _currentProductIndex = vidx;
                    _resetState();
                  });
                  if (_productHistory.length - vidx <= _lookahead) {
                    _startFetch();
                  }
                },
                itemBuilder: (_, vidx) {
                  final prod = _productHistory[vidx];
                  final horCtrl = PageController();

                  return GestureDetector(
                    onDoubleTapDown: _onDoubleTap,
                    onDoubleTap: () => setState(() => isLiked = true),
                    child: Stack(
                      children: [
                        PageView.builder(
                          key: ValueKey(prod.id),
                          controller: horCtrl,
                          allowImplicitScrolling: true,
                          itemCount: prod.images.length,
                          onPageChanged:
                              (h) => setState(() => _currentImageIndex = h),
                          itemBuilder:
                              (_, h) => Image(
                                image: CachedNetworkImageProvider(
                                  prod.images[h],
                                  headers: {"User-Agent": "Mozilla/5.0"},
                                ),
                                fit: BoxFit.cover,
                                gaplessPlayback: true,
                              ),
                        ),

                        if (_showHeart && _doubleTapPosition != null)
                          Positioned(
                            left: _doubleTapPosition!.dx - 40,
                            top: _doubleTapPosition!.dy - 40,
                            child: AnimatedOpacity(
                              opacity: _showHeart ? 1.0 : 0.0,
                              duration: const Duration(milliseconds: 300),
                              child: const Icon(
                                Icons.favorite,
                                color: Colors.red,
                                size: 80,
                              ),
                            ),
                          ),

                        Align(
                          alignment: Alignment.bottomCenter,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 160),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: _buildDots(
                                prod.images.length,
                                _currentImageIndex,
                              ),
                            ),
                          ),
                        ),

                        Positioned(
                          top: 60,
                          right: 12,
                          child: _outlinedIcon(
                            icon: Icons.filter_alt,
                            onPressed: () async {
                              final result =
                                  await Navigator.push<Map<String, dynamic>>(
                                    context,
                                    MaterialPageRoute(
                                      builder:
                                          (_) => PreferenceScreen(
                                            initialFilters: filters,
                                          ),
                                    ),
                                  );
                              if (!mounted) return;
                              setState(() {
                                filters = result;
                                _productHistory.clear();
                                _currentProductIndex = -1;
                              });
                              _fetchOne().then((_) {
                                for (int i = 1; i < _lookahead; i++) {
                                  _startFetch();
                                }
                              });
                            },
                          ),
                        ),

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
                                  prod.retailer,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  prod.name,
                                  style: const TextStyle(color: Colors.white),
                                ),
                                Text(
                                  prod.brand,
                                  style: const TextStyle(color: Colors.white),
                                ),
                                Text(
                                  '\$${prod.price.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                        Positioned(
                          right: 12,
                          bottom: MediaQuery.of(context).size.height * 0.25,
                          child: Column(
                            children: [
                              _outlinedIcon(
                                icon: Icons.favorite,
                                onPressed:
                                    () => setState(() => isLiked = !isLiked),
                                iconColor: isLiked ? Colors.red : Colors.white,
                              ),
                              const SizedBox(height: 24),
                              _outlinedIcon(
                                icon: Icons.bookmark,
                                onPressed:
                                    () => setState(() => isSaved = !isSaved),
                                iconColor:
                                    isSaved ? Colors.black : Colors.white,
                              ),
                              const SizedBox(height: 24),
                              AnimatedBuilder(
                                animation: _scaleAnimation,
                                builder:
                                    (_, child) => Transform.scale(
                                      scale: _scaleAnimation.value,
                                      child: _outlinedIcon(
                                        icon: Icons.shopping_bag,
                                        onPressed: _toggleBasket,
                                        iconColor:
                                            isInBasket
                                                ? Colors.lightGreen
                                                : Colors.white,
                                      ),
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
    );
  }
}
