import 'package:flutter/material.dart';
import 'package:frontend/services/product_item/item/product_item_service.dart';
import '../../models/product_item/product_item.dart';
import '../../widgets/product_item/product_item.dart';
import '../../models/product_item/filter.dart';

class HomeScreen extends StatefulWidget {
  final FilterDto? initialFilters;
  const HomeScreen({Key? key, this.initialFilters}) : super(key: key);

  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ProductItemService _service = ProductItemService();
  late Future<List<ProductItem>?> _itemsFuture;
  final PageController _verticalController = PageController();

  @override
  void initState() {
    super.initState();
    _itemsFuture =
        (widget.initialFilters != null)
            ? _service.getFilteredProductItems(widget.initialFilters!)
            : _service.getProductItems();
    print('initialItemsFuture: ${_itemsFuture.toString()}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: FutureBuilder<List<ProductItem>?>(
        future: _itemsFuture,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snap.data;
          debugPrint('🛠️ Loaded product items: ${items?.length ?? 0}');
          if (items == null || items.isEmpty) {
            return const Center(
              child: Text(
                'No products found',
                style: TextStyle(color: Colors.white),
              ),
            );
          }
          return PageView.builder(
            controller: _verticalController,
            scrollDirection: Axis.vertical,
            itemCount: items.length,
            itemBuilder: (_, idx) {
              return SizedBox.expand(
                child: ProductItemWidget(product: items[idx]),
              );
            },
            physics: const PageScrollPhysics(),
            allowImplicitScrolling: true,
          );
        },
      ),
    );
  }
}
