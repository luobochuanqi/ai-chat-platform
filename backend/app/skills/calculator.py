"""Calculator skill — 精确计算。

填 LLM「算不准大数」的洞：AI 通过 function calling 调用本 skill，
由服务端用受限表达式求值器精确计算，而非靠模型生成（模型是概率函数，大数运算常出错）。
"""
import ast
import operator
from typing import Any

from app.skills.base import BaseSkill

# 白名单运算符：只允许这些 AST 节点类型。
# 任何变量名(Name)/属性(Attribute)/调用(Call)都不会出现在这里，从而拒绝注入。
_ALLOWED_OPS: dict[type, Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,  # 一元负号 -
    ast.UAdd: operator.pos,  # 一元正号 +
}

# 结果绝对值上限，防止幂运算产生超大数消耗资源
_MAX_RESULT = 10 ** 100


def safe_eval(expression: str) -> Any:
    """安全求值算术表达式。

    用 ast 白名单节点遍历：只允许数字常量与四则运算/幂/取模/括号/一元正负。
    遇到变量名、属性访问、函数调用等节点一律抛 ValueError —— 拒绝代码注入。
    """
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"表达式语法错误: {expression!r}") from exc

    def _eval(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp):
            op_fn = _ALLOWED_OPS.get(type(node.op))
            if op_fn is None:
                raise ValueError(f"不支持的运算符: {type(node.op).__name__}")
            return op_fn(_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp):
            op_fn = _ALLOWED_OPS.get(type(node.op))
            if op_fn is None:
                raise ValueError(f"不支持的一元运算符: {type(node.op).__name__}")
            return op_fn(_eval(node.operand))
        raise ValueError(f"不支持的表达式元素: {type(node).__name__}")

    result = _eval(tree)
    if isinstance(result, (int, float)) and abs(result) > _MAX_RESULT:
        raise ValueError("计算结果超出允许范围")
    return result


class CalculatorSkill(BaseSkill):
    """精确计算 skill：四则运算、括号、幂、取模。"""

    @property
    def name(self) -> str:
        return "calculator"

    @property
    def description(self) -> str:
        return (
            "进行精确的数学计算。当用户需要计算算术表达式"
            "（加减乘除、括号、幂运算、取模、百分比）时使用。"
            "尤其适用于大数运算等需要精确数值结果的场景。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "要计算的数学表达式，如 (3+4)*2 或 1234*5678",
                }
            },
            "required": ["expression"],
        }

    async def execute(self, args: dict) -> str:
        if "expression" not in args:
            raise ValueError("缺少必填参数: expression")
        expression = str(args["expression"]).strip()
        if not expression:
            raise ValueError("expression 不能为空")
        result = safe_eval(expression)
        # 整数值结果去掉 .0 后缀，展示更自然
        if isinstance(result, float) and result.is_integer():
            result = int(result)
        return f"{expression} = {result}"


# 模块级单例，供注册表导入
calculator_skill = CalculatorSkill()
