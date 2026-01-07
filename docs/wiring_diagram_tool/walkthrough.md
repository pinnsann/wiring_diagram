# Wiring Diagram Tool - Full Walkthrough

全機能の実装が完了しました。

## 起動方法
1. エクスプローラーでフォルダ `e:/Antigravity_Program_Folder/wiring_diagram` を開きます。
2. `index.html` をダブルクリックしてブラウザで開いてください。

## 機能・操作手順

### 1. 基盤と配線
- **基盤**: サイズを変更して `Update Board`。
- **配線**: 色とタイプ（Front/Back）を選び、ドラッグして描画。
- **選択・削除**:
  - 配線の上をクリックすると**緑色**にハイライトされます。
  - その状態で `Delete` または `Backspace` キーを押すと配線が削除されます。

### 2. 部品 (Components)
- **追加**: Size, Label, Pinsを指定して `Add`。
- **移動**: ドラッグアンドドロップで自在に移動。
- **編集**: 
  - 部品をクリックして選択（青枠）。サイドバーで編集し `Update`。
- **削除**: 選択状態で `Delete` キー。

### 3. アンドゥ/リドゥ (Undo/Redo)
- `Ctrl + Z`: 元に戻す
- `Ctrl + Y`: やり直し
- 配線の追加や削除、部品の移動など、キャンバス上の操作は履歴として保持されます。

### 4. 保存・出力
- `Save` (JSON), `Load`, `Export PNG`。

ぜひお試しください。
