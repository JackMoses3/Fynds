import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:dropdown_search/dropdown_search.dart';

class PreferenceScreen extends StatefulWidget {
  final Map<String, dynamic>? initialFilters;
  const PreferenceScreen({Key? key, this.initialFilters}) : super(key: key);

  @override
  State<PreferenceScreen> createState() => _PreferenceScreenState();
}

class _PreferenceScreenState extends State<PreferenceScreen> {
  List<String> categories = [], brands = [], retailers = [];
  List<String> selectedCategories = [],
      selectedBrands = [],
      selectedRetailers = [];
  double? minPrice, maxPrice;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    final init = widget.initialFilters;
    if (init != null) {
      selectedCategories = List<String>.from(init['categories'] ?? <String>[]);
      selectedBrands = List<String>.from(init['brands'] ?? <String>[]);
      selectedRetailers = List<String>.from(init['retailers'] ?? <String>[]);
      minPrice = init['minPrice'] as double?;
      maxPrice = init['maxPrice'] as double?;
    }
    _loadAllOptions();
  }

  Future<void> _loadAllOptions() async {
    await Future.wait([_fetchRetailers(), _fetchBrands(), _fetchCategories()]);
    setState(() => isLoading = false);
  }

  Future<void> _fetchCategories() async {
    final params = <String>[];
    if (selectedBrands.isNotEmpty) {
      params.addAll(
        selectedBrands.map((b) => 'brand=${Uri.encodeComponent(b)}'),
      );
    }
    if (selectedRetailers.isNotEmpty) {
      params.addAll(
        selectedRetailers.map((r) => 'retailer=${Uri.encodeComponent(r)}'),
      );
    }
    final url =
        'http://10.0.2.2:3000/api/product-item/options/categories' +
        (params.isEmpty ? '' : '?${params.join('&')}');
    final res = await http.get(Uri.parse(url));
    final list = (jsonDecode(res.body) as List).cast<String>()..sort();
    setState(() {
      categories = list;
      selectedCategories = selectedCategories.where(list.contains).toList();
    });
  }

  Future<void> _fetchBrands() async {
    final params = <String>[];
    if (selectedCategories.isNotEmpty) {
      params.addAll(
        selectedCategories.map((c) => 'category=${Uri.encodeComponent(c)}'),
      );
    }
    if (selectedRetailers.isNotEmpty) {
      params.addAll(
        selectedRetailers.map((r) => 'retailer=${Uri.encodeComponent(r)}'),
      );
    }
    final url =
        'http://10.0.2.2:3000/api/product-item/options/brands' +
        (params.isEmpty ? '' : '?${params.join('&')}');
    final res = await http.get(Uri.parse(url));
    final list = (jsonDecode(res.body) as List).cast<String>()..sort();
    setState(() {
      brands = list;
      selectedBrands = selectedBrands.where(list.contains).toList();
    });
  }

  Future<void> _fetchRetailers() async {
    final params = <String>[];
    if (selectedCategories.isNotEmpty) {
      params.addAll(
        selectedCategories.map((c) => 'category=${Uri.encodeComponent(c)}'),
      );
    }
    if (selectedBrands.isNotEmpty) {
      params.addAll(
        selectedBrands.map((b) => 'brand=${Uri.encodeComponent(b)}'),
      );
    }
    final url =
        'http://10.0.2.2:3000/api/product-item/options/retailers' +
        (params.isEmpty ? '' : '?${params.join('&')}');
    final res = await http.get(Uri.parse(url));
    final list = (jsonDecode(res.body) as List).cast<String>()..sort();
    setState(() {
      retailers = list;
      selectedRetailers = selectedRetailers.where(list.contains).toList();
    });
  }

  void applyPreferences() {
    Navigator.pop(context, {
      'categories': selectedCategories,
      'brands': selectedBrands,
      'retailers': selectedRetailers,
      'minPrice': minPrice,
      'maxPrice': maxPrice,
    });
  }

  /// Clears all filters in-place and reloads options; stays on screen.
  void clearPreferences() {
    setState(() {
      selectedCategories.clear();
      selectedBrands.clear();
      selectedRetailers.clear();
      minPrice = null;
      maxPrice = null;
      isLoading = true;
    });
    _loadAllOptions();
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        final hasAnyFilter =
            selectedCategories.isNotEmpty ||
            selectedBrands.isNotEmpty ||
            selectedRetailers.isNotEmpty ||
            minPrice != null ||
            maxPrice != null;
        // If no filters, send null; otherwise send current filters
        Navigator.pop(
          context,
          hasAnyFilter
              ? {
                'categories': selectedCategories,
                'brands': selectedBrands,
                'retailers': selectedRetailers,
                'minPrice': minPrice,
                'maxPrice': maxPrice,
              }
              : null,
        );
        return false;
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Preferences')),
        body:
            isLoading
                ? const Center(child: CircularProgressIndicator())
                : Column(
                  children: [
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildDropdown(
                            label: 'Category',
                            items: categories,
                            selected: selectedCategories,
                            onChanged: (vals) async {
                              setState(() => selectedCategories = vals);
                              await Future.wait([
                                _fetchRetailers(),
                                _fetchBrands(),
                              ]);
                            },
                          ),
                          const SizedBox(height: 20),
                          _buildDropdown(
                            label: 'Brand',
                            items: brands,
                            selected: selectedBrands,
                            onChanged: (vals) async {
                              setState(() => selectedBrands = vals);
                              await Future.wait([
                                _fetchCategories(),
                                _fetchRetailers(),
                              ]);
                            },
                          ),
                          const SizedBox(height: 20),
                          _buildDropdown(
                            label: 'Retailer',
                            items: retailers,
                            selected: selectedRetailers,
                            onChanged: (vals) async {
                              setState(() => selectedRetailers = vals);
                              await Future.wait([
                                _fetchCategories(),
                                _fetchBrands(),
                              ]);
                            },
                          ),
                          const SizedBox(height: 20),
                          _buildPriceFilter(),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              onPressed: clearPreferences,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.grey,
                              ),
                              child: const Text('Clear'),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: applyPreferences,
                              child: const Text('Apply'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required List<String> items,
    required List<String> selected,
    required Future<void> Function(List<String>) onChanged,
  }) {
    return DropdownSearch<String>.multiSelection(
      key: ValueKey('$label:${items.join(",")}'),
      items: items,
      selectedItems: selected,
      popupProps: PopupPropsMultiSelection.modalBottomSheet(
        showSearchBox: true,
        searchFieldProps: const TextFieldProps(
          decoration: InputDecoration(
            hintText: 'Search…',
            border: OutlineInputBorder(),
          ),
        ),
      ),
      dropdownDecoratorProps: DropDownDecoratorProps(
        dropdownSearchDecoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
      onChanged: onChanged,
      clearButtonProps: const ClearButtonProps(isVisible: true),
    );
  }

  Widget _buildPriceFilter() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('Price Range', style: TextStyle(fontWeight: FontWeight.bold)),
      const SizedBox(height: 8),
      Row(
        children: [
          Expanded(
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Min Price',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              onChanged: (v) => setState(() => minPrice = double.tryParse(v)),
              controller: TextEditingController(
                text: minPrice?.toString() ?? '',
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Max Price',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              onChanged: (v) => setState(() => maxPrice = double.tryParse(v)),
              controller: TextEditingController(
                text: maxPrice?.toString() ?? '',
              ),
            ),
          ),
        ],
      ),
    ],
  );
}
