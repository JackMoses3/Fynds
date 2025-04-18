// lib/screens/home_screen.dart

import 'dart:convert';
import 'package:flutter/material.dart';
import 'preferences_screen.dart';
import 'package:http/http.dart' as http;
import '../models/product_item.dart';
import 'package:cached_network_image/cached_network_image.dart';

class HomeScreen extends StatefulWidget {
  final Map<String, dynamic>? initialFilters;
  const HomeScreen({super.key, this.initialFilters});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  final List<ProductItem> _productHistory = [];
  int _currentProductIndex = -1;
  bool _isFetching = false;
  Map<String, dynamic>? filters;

  bool isLiked = false;
  bool isSaved = false;
  bool isInBasket = false;
  int _currentImageIndex = 0;

  // Only the vertical controller lives at state level:
  final PageController _verticalController = PageController();

  late final AnimationController _basketController;
  late final Animation<double> _scaleAnimation;

  ProductItem? get product =>
      (_currentProductIndex >= 0 &&
              _currentProductIndex < _productHistory.length)
          ? _productHistory[_currentProductIndex]
          : null;

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

    // Prime the feed with two products immediately
    fetchAndAddProduct().then((_) => fetchAndAddProduct());
  }

  Future<void> fetchAndAddProduct() async {
    if (_isFetching) return;
    _isFetching = true;

    http.Response? response;
    try {
      if (filters != null && filters!.isNotEmpty) {
        response = await http.post(
          Uri.parse(
            'http://10.0.2.2:3000/api/product-item/random-with-filters',
          ),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'brand': filters!['brands'],
            'retailer': filters!['retailers'],
            'category': filters!['categories'],
            'minPrice': filters!['minPrice'],
            'maxPrice': filters!['maxPrice'],
          }),
        );
      } else {
        response = await http.get(
          Uri.parse('http://10.0.2.2:3000/api/product-item/random'),
        );
      }

      // Accept any 2xx (NestJS POST default is 201)
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (!mounted) return;
        final Map<String, dynamic> jsonMap =
            jsonDecode(response.body) as Map<String, dynamic>;
        final newProduct = ProductItem.fromJson(jsonMap);
        if (newProduct.images.isEmpty) return;

        setState(() {
          _productHistory.add(newProduct);
          if (_currentProductIndex == -1) {
            _currentProductIndex = 0;
            _resetState();
          }
        });
      } else if (response.statusCode == 404) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("No matching products found.")),
        );
      } else {
        debugPrint(
          '❌ Failed to load product: ${response.statusCode} ${response.body}',
        );
      }
    } catch (e, stack) {
      debugPrint('❌ Error fetching product: $e\n$stack');
    } finally {
      _isFetching = false;
    }
  }

  void _resetState() {
    isLiked = false;
    isSaved = false;
    isInBasket = false;
    _currentImageIndex = 0;
  }

  void toggleBasket() {
    setState(() {
      isInBasket = !isInBasket;
    });
    _basketController.forward().then((_) => _basketController.reverse());
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(isInBasket ? 'Added to basket' : 'Removed from basket'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  List<Widget> buildDots(int count, int activeIndex) {
    final int totalDots = count > 5 ? 5 : count;
    int startIndex = 0;
    if (count > 5) {
      if (activeIndex <= 2) {
        startIndex = 0;
      } else if (activeIndex >= count - 3) {
        startIndex = count - 5;
      } else {
        startIndex = activeIndex - 2;
      }
    }
    return List<Widget>.generate(totalDots, (i) {
      final bool isActive = startIndex + i == activeIndex;
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.black.withAlpha(153),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white),
        ),
      );
    });
  }

  @override
  void dispose() {
    _basketController.dispose();
    _verticalController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body:
          product == null
              ? const Center(child: CircularProgressIndicator())
              : PageView.builder(
                controller: _verticalController,
                scrollDirection: Axis.vertical,
                itemCount: _productHistory.length,
                onPageChanged: (verticalIndex) {
                  setState(() {
                    _currentProductIndex = verticalIndex;
                    _resetState();
                  });
                  if (verticalIndex >= _productHistory.length - 2) {
                    fetchAndAddProduct();
                  }
                },
                itemBuilder: (context, verticalIndex) {
                  final current = _productHistory[verticalIndex];
                  final horController = PageController();

                  return Stack(
                    children: [
                      // IMAGE CAROUSEL
                      PageView.builder(
                        key: ValueKey(current.id),
                        controller: horController,
                        itemCount: current.images.length,
                        onPageChanged: (hIndex) {
                          setState(() {
                            _currentImageIndex = hIndex;
                          });
                        },
                        itemBuilder: (ctx, hIndex) {
                          return CachedNetworkImage(
                            imageUrl: current.images[hIndex],
                            fit: BoxFit.cover,
                            httpHeaders: {"User-Agent": "Mozilla/5.0"},
                            placeholder:
                                (_, __) => const Center(
                                  child: CircularProgressIndicator(),
                                ),
                            errorWidget:
                                (_, __, ___) => const Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.broken_image,
                                        color: Colors.red,
                                        size: 50,
                                      ),
                                      SizedBox(height: 8),
                                      Text(
                                        'Image failed to load',
                                        style: TextStyle(color: Colors.white),
                                      ),
                                    ],
                                  ),
                                ),
                          );
                        },
                      ),

                      // PAGE INDICATOR DOTS
                      Align(
                        alignment: Alignment.bottomCenter,
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 130),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: buildDots(
                              current.images.length,
                              _currentImageIndex,
                            ),
                          ),
                        ),
                      ),

                      // FILTER BUTTON (now seeds two items on apply)
                      Positioned(
                        top: 40,
                        left: 20,
                        child: IconButton(
                          icon: const Icon(
                            Icons.filter_alt,
                            color: Colors.white,
                            size: 30,
                          ),
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
                            // seed two filtered products so vertical scrolling works
                            await fetchAndAddProduct();
                            await fetchAndAddProduct();
                          },
                        ),
                      ),

                      // PRODUCT INFO CARD
                      Positioned(
                        bottom: 20,
                        left: 20,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.black.withAlpha(153),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                current.retailer,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                current.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                current.brand,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                '\$${current.price.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // ACTION BUTTONS (like, save, basket)
                      Positioned(
                        right: 12,
                        bottom: MediaQuery.of(context).size.height * 0.25,
                        child: Column(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.favorite),
                              iconSize: 36,
                              color: isLiked ? Colors.red : Colors.white,
                              onPressed: () {
                                setState(() => isLiked = !isLiked);
                              },
                            ),
                            const SizedBox(height: 24),
                            IconButton(
                              icon: const Icon(Icons.bookmark),
                              iconSize: 36,
                              color: isSaved ? Colors.black : Colors.white,
                              onPressed: () {
                                setState(() => isSaved = !isSaved);
                              },
                            ),
                            const SizedBox(height: 24),
                            AnimatedBuilder(
                              animation: _scaleAnimation,
                              builder: (_, child) {
                                return Transform.scale(
                                  scale: _scaleAnimation.value,
                                  child: IconButton(
                                    icon: const Icon(Icons.shopping_bag),
                                    iconSize: 36,
                                    color:
                                        isInBasket
                                            ? Colors.greenAccent
                                            : Colors.white,
                                    onPressed: toggleBasket,
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                },
              ),
    );
  }
}
