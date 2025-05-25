import 'package:flutter/material.dart';

class PreferenceDisplay extends StatelessWidget {
  final List<String> allCategories;
  final List<String> allBrands;
  final List<String> allRetailers;

  final List<String> selectedCategories;
  final List<String> selectedBrands;
  final List<String> selectedRetailers;
  final int? minPrice;
  final int? maxPrice;

  final TextEditingController minPriceController;
  final TextEditingController maxPriceController;

  final bool loadingCategories;
  final bool loadingBrands;
  final bool loadingRetailers;

  final ValueChanged<List<String>> onCategoriesChanged;
  final ValueChanged<List<String>> onBrandsChanged;
  final ValueChanged<List<String>> onRetailersChanged;
  final ValueChanged<int?> onMinPriceChanged;
  final ValueChanged<int?> onMaxPriceChanged;

  final VoidCallback onClear;
  final VoidCallback onApply;

  const PreferenceDisplay({
    Key? key,
    required this.allCategories,
    required this.allBrands,
    required this.allRetailers,
    required this.selectedCategories,
    required this.selectedBrands,
    required this.selectedRetailers,
    this.minPrice,
    this.maxPrice,
    required this.minPriceController,
    required this.maxPriceController,
    this.loadingCategories = false,
    this.loadingBrands = false,
    this.loadingRetailers = false,
    required this.onCategoriesChanged,
    required this.onBrandsChanged,
    required this.onRetailersChanged,
    required this.onMinPriceChanged,
    required this.onMaxPriceChanged,
    required this.onClear,
    required this.onApply,
  }) : super(key: key);

  Future<void> _showMultiSelect(
    BuildContext context,
    String title,
    List<String> options,
    List<String> initialSelected,
    ValueChanged<List<String>> onConfirm,
  ) async {
    List<String> temp = List.from(initialSelected);
    String filter = '';

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final height = MediaQuery.of(ctx).size.height * 0.6;
        return SizedBox(
          height: height,
          child: Column(
            children: [
              // Header with title + close icon
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Search $title', style: const TextStyle(fontSize: 16)),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),

              // Search input
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Type to filter',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      vertical: 12,
                      horizontal: 12,
                    ),
                  ),
                  onChanged: (val) => filter = val,
                ),
              ),
              const SizedBox(height: 8),

              // Options list or “no X found”
              Expanded(
                child: Builder(
                  builder: (innerCtx) {
                    final filtered =
                        options
                            .where(
                              (o) => o.toLowerCase().contains(
                                filter.toLowerCase(),
                              ),
                            )
                            .toList();
                    if (filtered.isEmpty) {
                      return Center(child: Text('No $title found'));
                    }
                    return ListView.builder(
                      itemCount: filtered.length,
                      itemBuilder: (_, i) {
                        final opt = filtered[i];
                        final sel = temp.contains(opt);
                        return CheckboxListTile(
                          title: Text(opt),
                          value: sel,
                          onChanged: (chk) {
                            if (chk == true)
                              temp.add(opt);
                            else
                              temp.remove(opt);
                            (innerCtx as Element).markNeedsBuild();
                          },
                        );
                      },
                    );
                  },
                ),
              ),

              // OK button
              Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      onConfirm(temp);
                    },
                    child: const Text('OK'),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Builds the dropdown‐style field with a label, hint text, and chips.
  InputDecorator _buildMultiSelectField<T>(
    String title,
    List<String> selected,
    bool loading,
    ValueChanged<String> onDelete,
  ) {
    return InputDecorator(
      decoration: InputDecoration(
        labelText: title,
        hintText: selected.isEmpty ? 'No $title selected' : null,
        border: OutlineInputBorder(),
        suffixIcon: const Icon(Icons.arrow_drop_down),
      ),
      isEmpty: selected.isEmpty,
      child:
          loading
              ? const LinearProgressIndicator()
              : (selected.isEmpty
                  ? const SizedBox.shrink()
                  : Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children:
                        selected.map((s) {
                          return Chip(
                            label: Text(s),
                            onDeleted: () => onDelete(s),
                          );
                        }).toList(),
                  )),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Preferences'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category field
            GestureDetector(
              onTap:
                  () => _showMultiSelect(
                    context,
                    'Category',
                    allCategories,
                    selectedCategories,
                    onCategoriesChanged,
                  ),
              child: _buildMultiSelectField(
                'Category',
                selectedCategories,
                loadingCategories,
                (val) {
                  final newList = List<String>.from(selectedCategories)
                    ..remove(val);
                  onCategoriesChanged(newList);
                },
              ),
            ),
            const SizedBox(height: 16),

            // Brand
            GestureDetector(
              onTap:
                  () => _showMultiSelect(
                    context,
                    'Brand',
                    allBrands,
                    selectedBrands,
                    onBrandsChanged,
                  ),
              child: _buildMultiSelectField(
                'Brand',
                selectedBrands,
                loadingBrands,
                (val) {
                  final newList = List<String>.from(selectedBrands)
                    ..remove(val);
                  onBrandsChanged(newList);
                },
              ),
            ),
            const SizedBox(height: 16),

            // Retailer
            GestureDetector(
              onTap:
                  () => _showMultiSelect(
                    context,
                    'Retailer',
                    allRetailers,
                    selectedRetailers,
                    onRetailersChanged,
                  ),
              child: _buildMultiSelectField(
                'Retailer',
                selectedRetailers,
                loadingRetailers,
                (val) {
                  final newList = List<String>.from(selectedRetailers)
                    ..remove(val);
                  onRetailersChanged(newList);
                },
              ),
            ),
            const SizedBox(height: 24),

            // Price Range label
            const Text(
              'Price Range',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),

            // Min/Max price
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: minPriceController,
                    decoration: const InputDecoration(
                      labelText: 'Min Price',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (txt) => onMinPriceChanged(int.tryParse(txt)),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextFormField(
                    controller: maxPriceController,
                    decoration: const InputDecoration(
                      labelText: 'Max Price',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (txt) => onMaxPriceChanged(int.tryParse(txt)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: onClear,
                child: const Text('Clear'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton(
                onPressed: onApply,
                child: const Text('Apply'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
