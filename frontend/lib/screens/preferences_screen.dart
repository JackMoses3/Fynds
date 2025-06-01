import 'package:flutter/material.dart';
import '../models/product_item/filter.dart';
import '../services/product_item/filter/filter_service.dart';
import '../widgets/preference_display.dart';

class PreferencesScreen extends StatefulWidget {
  final FilterDto? initialFilters;
  const PreferencesScreen({Key? key, this.initialFilters}) : super(key: key);

  @override
  _PreferencesScreenState createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends State<PreferencesScreen> {
  final FilterService _filterService = FilterService();

  // Available options
  List<String> _allCategories = [];
  List<String> _allBrands = [];
  List<String> _allRetailers = [];

  // User’s multi‐selections
  List<String> _selectedCategories = [];
  List<String> _selectedBrands = [];
  List<String> _selectedRetailers = [];

  int? _minPrice;
  int? _maxPrice;

  // Controllers for price fields
  final TextEditingController _minPriceController = TextEditingController();
  final TextEditingController _maxPriceController = TextEditingController();

  // Loading flags
  bool _loadingCategories = false;
  bool _loadingBrands = false;
  bool _loadingRetailers = false;

  @override
  void initState() {
    super.initState();
    // Pre‐populate if initial filters provided
    if (widget.initialFilters != null) {
      final f = widget.initialFilters!;
      if (f.categories != null) _selectedCategories = List.from(f.categories!);
      if (f.brands != null) _selectedBrands = List.from(f.brands!);
      if (f.retailers != null) _selectedRetailers = List.from(f.retailers!);
      _minPrice = f.minPrice;
      _maxPrice = f.maxPrice;
      _minPriceController.text = f.minPrice?.toString() ?? '';
      _maxPriceController.text = f.maxPrice?.toString() ?? '';
    }
    _loadAllOptions();
  }

  @override
  void dispose() {
    _minPriceController.dispose();
    _maxPriceController.dispose();
    super.dispose();
  }

  Future<void> _loadAllOptions() async {
    setState(() {
      _loadingCategories = true;
      _loadingBrands = true;
      _loadingRetailers = true;
    });

    final catsResult = await _filterService.getCategoriesPerBraRet([], []);
    final brandsResult = await _filterService.getBrandsPerCatRet([], []);
    final retailersResult = await _filterService.getRetailersPerBraCat([], []);

    // Sort alphabetically
    final cats = List<String>.from(catsResult?.categories ?? [])..sort();
    final brands = List<String>.from(brandsResult?.brands ?? [])..sort();
    final retailers = List<String>.from(retailersResult?.retailers ?? [])
      ..sort();

    setState(() {
      _allCategories = cats;
      _allBrands = brands;
      _allRetailers = retailers;
      _loadingCategories = false;
      _loadingBrands = false;
      _loadingRetailers = false;
    });
  }

  Future<void> _loadCategories(
    List<String> brands,
    List<String> retailers,
  ) async {
    setState(() => _loadingCategories = true);
    final result = await _filterService.getCategoriesPerBraRet(
      brands,
      retailers,
    );
    final cats = List<String>.from(result?.categories ?? [])..sort();
    setState(() {
      _allCategories = cats;
      _loadingCategories = false;
    });
  }

  Future<void> _loadBrands(
    List<String> categories,
    List<String> retailers,
  ) async {
    setState(() => _loadingBrands = true);
    final result = await _filterService.getBrandsPerCatRet(
      categories,
      retailers,
    );
    final brands = List<String>.from(result?.brands ?? [])..sort();
    setState(() {
      _allBrands = brands;
      _loadingBrands = false;
    });
  }

  Future<void> _loadRetailers(
    List<String> brands,
    List<String> categories,
  ) async {
    setState(() => _loadingRetailers = true);
    final result = await _filterService.getRetailersPerBraCat(
      brands,
      categories,
    );
    final retailers = List<String>.from(result?.retailers ?? [])..sort();
    setState(() {
      _allRetailers = retailers;
      _loadingRetailers = false;
    });
  }

  void _onClear() {
    setState(() {
      _selectedCategories = [];
      _selectedBrands = [];
      _selectedRetailers = [];
      _minPrice = null;
      _maxPrice = null;
      _minPriceController.text = '';
      _maxPriceController.text = '';
    });
    _loadAllOptions();
  }

  void _onApply() {
    final dto = FilterDto(
      categories: _selectedCategories.isEmpty ? null : _selectedCategories,
      brands: _selectedBrands.isEmpty ? null : _selectedBrands,
      retailers: _selectedRetailers.isEmpty ? null : _selectedRetailers,
      minPrice: _minPrice,
      maxPrice: _maxPrice,
    );
    Navigator.pop(context, dto.toJson());
  }

  @override
  Widget build(BuildContext context) {
    return PreferenceDisplay(
      allCategories: _allCategories,
      allBrands: _allBrands,
      allRetailers: _allRetailers,
      selectedCategories: _selectedCategories,
      selectedBrands: _selectedBrands,
      selectedRetailers: _selectedRetailers,
      minPrice: _minPrice,
      maxPrice: _maxPrice,
      minPriceController: _minPriceController,
      maxPriceController: _maxPriceController,
      loadingCategories: _loadingCategories,
      loadingBrands: _loadingBrands,
      loadingRetailers: _loadingRetailers,
      onCategoriesChanged: (newCats) {
        setState(() => _selectedCategories = newCats);
        _loadBrands(newCats, _selectedRetailers);
        _loadRetailers(_selectedBrands, newCats);
      },
      onBrandsChanged: (newBrands) {
        setState(() => _selectedBrands = newBrands);
        _loadCategories(newBrands, _selectedRetailers);
        _loadRetailers(newBrands, _selectedCategories);
      },
      onRetailersChanged: (newRetailers) {
        setState(() => _selectedRetailers = newRetailers);
        _loadCategories(_selectedBrands, newRetailers);
        _loadBrands(_selectedCategories, newRetailers);
      },
      onMinPriceChanged: (p) {
        setState(() => _minPrice = p);
      },
      onMaxPriceChanged: (p) {
        setState(() => _maxPrice = p);
      },
      onClear: _onClear,
      onApply: _onApply,
    );
  }
}
