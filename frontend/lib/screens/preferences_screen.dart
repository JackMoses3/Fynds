import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:dropdown_search/dropdown_search.dart';

class PreferenceScreen extends StatefulWidget {
  final Map<String, dynamic>? initialFilters; //filters passed from home screen

  const PreferenceScreen({
    super.key,
    this.initialFilters,
  }); //accept filters from home screen

  @override
  State<PreferenceScreen> createState() => _PreferenceScreenState();
}

class _PreferenceScreenState extends State<PreferenceScreen> {
  List<String> categories = [];
  List<String> selectedCategories =
      []; // Stores selected categories for filtering

  List<String> brands = [];
  List<String> selectedBrands = []; // Stores selected brands for filtering

  List<String> retailers = [];
  List<String> selectedRetailers =
      []; // Stores selected retailers for filtering

  double? minPrice;
  double? maxPrice;

  bool isLoading = true; // indicates if data is still loading

  @override
  void initState() {
    super.initState();
    fetchOptions(); // Fetch category, brand, and retailer options from the backend
  }

  Future<void> fetchOptions() async {
    try {
      final categoryRes = await http.get(
        Uri.parse('http://10.0.2.2:3000/api/product-item/options/categories'),
      );
      final brandRes = await http.get(
        Uri.parse('http://10.0.2.2:3000/api/product-item/options/brands'),
      );
      final retailerRes = await http.get(
        Uri.parse('http://10.0.2.2:3000/api/product-item/options/retailers'),
      );

      setState(() {
        categories = List<String>.from(jsonDecode(categoryRes.body)..sort());
        brands = List<String>.from(jsonDecode(brandRes.body)..sort());
        retailers = List<String>.from(jsonDecode(retailerRes.body)..sort());
        isLoading = false;
      });
    } catch (e) {
      debugPrint("❌ Error fetching options: $e");
    }
  }

  // Apply the selected preferences and pass them back to HomeScreen
  void applyPreferences() {
    Navigator.pop(context, {
      'categories': selectedCategories,
      'brands': selectedBrands,
      'retailers': selectedRetailers,
      'minPrice': minPrice,
      'maxPrice': maxPrice,
    });
  }

  // When clear is clicked, clear all selected preferences and return null to HomeScreen
  void clearPreferences() {
    Navigator.pop(context, null); // Null means no filters
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Preferences")),
      body:
          isLoading
              ? const Center(child: CircularProgressIndicator())
              : Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        buildMultiSelect(
                          "Category",
                          categories,
                          selectedCategories,
                        ),
                        const SizedBox(height: 20),
                        buildPriceFilter(),
                        const SizedBox(height: 20),
                        buildDropdownMulti("Brand", brands, selectedBrands),
                        const SizedBox(height: 20),
                        buildDropdownMulti(
                          "Retailer",
                          retailers,
                          selectedRetailers,
                        ),
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
    );
  }

  Widget buildMultiSelect(
    String label,
    List<String> options,
    List<String> selected,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
        Wrap(
          spacing: 8,
          children:
              options.map((option) {
                return FilterChip(
                  label: Text(option),
                  selected: selected.contains(option),
                  onSelected: (bool value) {
                    setState(() {
                      value ? selected.add(option) : selected.remove(option);
                    });
                  },
                );
              }).toList(),
        ),
      ],
    );
  }

  Widget buildDropdownMulti(
    String label,
    List<String> options,
    List<String> selected,
  ) {
    return DropdownSearch<String>.multiSelection(
      items: options,
      selectedItems: selected,
      popupProps: const PopupPropsMultiSelection.modalBottomSheet(
        showSearchBox: true,
      ),
      dropdownDecoratorProps: DropDownDecoratorProps(
        dropdownSearchDecoration: InputDecoration(labelText: label),
      ),
      onChanged: (value) {
        setState(() {
          selected.clear();
          selected.addAll(value);
        });
      },
    );
  }

  Widget buildPriceFilter() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "Price Range",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        Row(
          children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(labelText: 'Min Price'),
                keyboardType: TextInputType.number,
                onChanged:
                    (value) => setState(() {
                      minPrice = double.tryParse(value);
                    }),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                decoration: const InputDecoration(labelText: 'Max Price'),
                keyboardType: TextInputType.number,
                onChanged:
                    (value) => setState(() {
                      maxPrice = double.tryParse(value);
                    }),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
