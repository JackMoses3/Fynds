import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/product_item/product_item.dart';
import 'package:fynds/services/basket/basket_service.dart';
import 'package:fynds/services/like/like_service.dart' as like_service;
import 'package:fynds/services/collection/collection_service.dart';
import 'package:fynds/models/collection.dart';

class ProductItemWidget extends StatefulWidget {
  final ProductItem product;
  const ProductItemWidget({Key? key, required this.product}) : super(key: key);

  @override
  _ProductItemWidgetState createState() => _ProductItemWidgetState();
}

class _ProductItemWidgetState extends State<ProductItemWidget>
    with SingleTickerProviderStateMixin {
  bool _isLiked = false, _isSaved = false, _isInBasket = false;
  int _currentImage = 0;
  late final PageController _pageController;
  late final AnimationController _basketController;
  late final Animation<double> _basketAnimation;

  final _likeService = like_service.LikeService();
  final _collectionService = CollectionService();

  // For demo: use the first collection as the "saved" collection
  int? _myCollectionId;

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
    )..addStatusListener((s) {
      if (s == AnimationStatus.completed) _basketController.reverse();
    });

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _fetchStates();
      for (final img in widget.product.images) {
        precacheImage(
          CachedNetworkImageProvider(
            img.imageUrl,
            headers: {"User-Agent": "Mozilla/5.0"},
          ),
          context,
        );
      }
    });
  }

  Future<void> _fetchStates() async {
    // Liked
    final likedIds = await _likeService.getLikedProductIds();
    setState(() {
      _isLiked = likedIds.contains(widget.product.id);
    });

    // Saved (in any collection)
    final savedIds = await _collectionService.getSavedProductIds();
    setState(() {
      _isSaved = savedIds.contains(widget.product.id);
    });

    // In basket (optional: you may want to fetch basket here as well)
    // For now, keep as before or implement similar logic if needed

    // For demo: fetch first collection ID for save/unsave
    final collections = await _collectionService.getCollections();
    if (collections != null && collections.isNotEmpty) {
      _myCollectionId = collections.first.id;
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _basketController.dispose();
    super.dispose();
  }

  Widget _buildDots() {
    final count = widget.product.images.length;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (i) {
        final active = i == _currentImage;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: active ? 12 : 8,
          height: active ? 12 : 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? Colors.white : Colors.white54,
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
  }) => Stack(
    alignment: Alignment.center,
    children: [
      Icon(icon, size: 36, color: Colors.black),
      IconButton(icon: Icon(icon), color: color, onPressed: onTap),
    ],
  );

  // --- Instagram-style Add to Collection Modal ---
  Future<void> _showAddToCollectionSheet(BuildContext context) async {
    final collections = await _collectionService.getCollections();
    int? selectedCollectionId;
    List<CollectionList> localCollections = List.from(collections ?? []);

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Padding(
          padding: MediaQuery.of(context).viewInsets,
          child: StatefulBuilder(
            builder: (context, setModalState) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 12),
                  const Text(
                    'Add to Collection',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  ...localCollections.map(
                    (c) => ListTile(
                      title: Text(c.name),
                      trailing:
                          selectedCollectionId == c.id
                              ? const Icon(Icons.check, color: Colors.blue)
                              : null,
                      onTap: () {
                        setModalState(() => selectedCollectionId = c.id);
                      },
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.add),
                    title: const Text('Create New Collection'),
                    onTap: () async {
                      final controller = TextEditingController();
                      final created = await showDialog(
                        context: context,
                        builder:
                            (context) => AlertDialog(
                              title: const Text('New Collection'),
                              content: TextField(
                                controller: controller,
                                autofocus: true,
                                decoration: const InputDecoration(
                                  labelText: 'Collection Name',
                                ),
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(context, null),
                                  child: const Text('Cancel'),
                                ),
                                ElevatedButton(
                                  onPressed:
                                      () => Navigator.pop(
                                        context,
                                        controller.text.trim(),
                                      ),
                                  child: const Text('Create'),
                                ),
                              ],
                            ),
                      );
                      if (created != null && created.isNotEmpty) {
                        final newCol = await _collectionService
                            .createNewCollection(created);
                        if (newCol != null) {
                          setModalState(() {
                            localCollections.add(newCol);
                            selectedCollectionId = newCol.id;
                          });
                        }
                      }
                    },
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed:
                        selectedCollectionId == null
                            ? null
                            : () async {
                              await _collectionService.addProductToCollection(
                                selectedCollectionId!,
                                widget.product.id,
                              );
                              Navigator.pop(context);
                              setState(() => _isSaved = true);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Added to collection!'),
                                ),
                              );
                            },
                    child: const Text('Add'),
                  ),
                  const SizedBox(height: 16),
                ],
              );
            },
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    return GestureDetector(
      onDoubleTap: () async {
        await _likeService.likeProduct(p.id);
        setState(() => _isLiked = true);
      },
      child: Stack(
        children: [
          // ── Horizontal carousel ──
          PageView.builder(
            key: ValueKey(p.id),
            controller: _pageController,
            scrollDirection: Axis.horizontal,
            itemCount: p.images.length,
            onPageChanged: (i) {
              setState(() => _currentImage = i);
              for (int off = 1; off <= 2; off++) {
                if (i + off < p.images.length) {
                  precacheImage(
                    CachedNetworkImageProvider(
                      p.images[i + off].imageUrl,
                      headers: {"User-Agent": "Mozilla/5.0"},
                    ),
                    context,
                  );
                }
              }
            },
            itemBuilder:
                (_, i) => CachedNetworkImage(
                  imageUrl: p.images[i].imageUrl,
                  httpHeaders: {"User-Agent": "Mozilla/5.0"},
                  fadeInDuration: Duration.zero,
                  fadeOutDuration: Duration.zero,
                  imageBuilder:
                      (ctx, prov) => Image(
                        image: prov,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        gaplessPlayback: true,
                      ),
                  placeholder:
                      (_, __) => const Center(
                        child: CircularProgressIndicator(color: Colors.white),
                      ),
                  errorWidget:
                      (_, __, ___) => const Center(
                        child: Icon(
                          Icons.broken_image,
                          color: Colors.red,
                          size: 50,
                        ),
                      ),
                ),
          ),

          // ── Dots ──
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 160),
              child: _buildDots(),
            ),
          ),

          // ── Info ──
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

          // ── Actions ──
          Positioned(
            right: 12,
            bottom: MediaQuery.of(context).size.height * 0.25,
            child: Column(
              children: [
                _actionIcon(Icons.favorite, () async {
                  if (_isLiked) {
                    await _likeService.unlikeProduct(p.id);
                  } else {
                    await _likeService.likeProduct(p.id);
                  }
                  setState(() => _isLiked = !_isLiked);
                }, color: _isLiked ? Colors.red : Colors.white),
                const SizedBox(height: 24),
                _actionIcon(Icons.bookmark, () async {
                  await _showAddToCollectionSheet(context);
                }, color: _isSaved ? Colors.red : Colors.white),
                const SizedBox(height: 24),
                ScaleTransition(
                  scale: _basketAnimation,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const Icon(
                        Icons.shopping_bag,
                        size: 36,
                        color: Colors.black,
                      ),
                      IconButton(
                        icon: const Icon(Icons.shopping_bag),
                        color: _isInBasket ? Colors.red : Colors.white,
                        onPressed: () async {
                          if (_isInBasket) {
                            await BasketService().removeFromBasket(
                              widget.product.id,
                            );
                            setState(() => _isInBasket = false);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Removed from basket'),
                              ),
                            );
                          } else {
                            await BasketService().addToBasket(
                              widget.product.id,
                            );
                            setState(() => _isInBasket = true);
                            _basketController.forward();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Added to basket')),
                            );
                          }
                        },
                      ),
                    ],
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
