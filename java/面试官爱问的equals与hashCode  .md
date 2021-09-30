# 面试官爱问的equals与hashCode

equals和hashCode都是Object对象中的非final方法，它们设计的目的就是被用来覆盖(override)的，所以在程序设计中还是经常需要处理这两个方法的。而掌握这两个方法的覆盖准则以及它们的区别还是很必要的，相关问题也不少。



下面我们继续以一次面试的问答，来考察对equals和hashCode的掌握情况。

## 面试官: Java里面有`==`运算符了，为什么还需要equals啊？

------

equals()的作用是用来判断两个对象是否相等，在Object里面的定义是：

```java
public boolean equals(Object obj) {
    return (this == obj);
}
```

这说明在我们实现自己的equals方法之前，equals等价于`==`,而`==`运算符是判断两个对象是不是同一个对象，即他们的**地址是否相等**。而覆写equals更多的是追求两个对象在**逻辑上的相等**，你可以说是**值相等**，也可说是**内容相等**。

在以下几种条件中，不覆写equals就能达到目的：

- **类的每个实例本质上是唯一的**：强调活动实体的而不关心值得，比如Thread，我们在乎的是哪一个线程，这时候用equals就可以比较了。
- **不关心类是否提供了逻辑相等的测试功能**：有的类的使用者不会用到它的比较值得功能，比如Random类，基本没人会去比较两个随机值吧
- **超类已经覆盖了equals，子类也只需要用到超类的行为**：比如AbstractMap里已经覆写了equals，那么继承的子类行为上也就需要这个功能，那也不需要再实现了。
- **类是私有的或者包级私有的，那也用不到equals方法**：这时候需要覆写equals方法来禁用它：`@Override public boolean equals(Object obj) { throw new AssertionError();}`

## 面试官：那么你知道覆写equals时有哪些准则？

------

这个我在Effective Java上看过，没记错的话应该是：

> **自反性**：对于任何非空引用值 x，x.equals(x) 都应返回 true。

> **对称性**：对于任何非空引用值 x 和 y，当且仅当 y.equals(x) 返回 true 时，x.equals(y) 才应返回 true。

> **传递性**：对于任何非空引用值 x、y 和 z，如果 x.equals(y) 返回 true， 并且 y.equals(z) 返回 true，那么 x.equals(z) 应返回 true。

> **一致性**：对于任何非空引用值 x 和 y，多次调用 x.equals(y) 始终返回 true 或始终返回 false， 前提是对象上 equals 比较中所用的信息没有被修改。

> **非空性**：对于任何非空引用值 x，x.equals(null) 都应返回 false。

## 面试官：说说哪些情况下会违反对称性和传递性

------

#### 违反对称性

对称性就是x.equals(y)时，y也得equals x，很多时候，我们自己覆写equals时，让自己的类可以兼容等于一个已知类，比如下面的例子：

```java
public final class CaseInsensitiveString {
    private final String s;
    public CaseInsensitiveString(String s) {
        if (s == null)
            throw new NullPointerException();
        this.s = s;
    }
    
    @Override
    public boolean equals(Object o) {
        if (o instanceof CaseInsensiticeString)
            return s.equalsIgnoreCase(((CaseInsensitiveString)o).s);
        if (o instanceof String)
            return s.equalsIgnoreCase((String) o);
        return false;
    }
}

```

这个想法很好，想创建一个无视大小写的String，并且还能够兼容String作为参数，假设我们创建一个CaseInsensitiveString:

```java
CaseInsensitiveString cis = new CaseInsensitiveString("Case");
```

那么肯定有`cis.equals("case")`,问题来了，`"case".equals(cis)`吗？String并没有兼容CaseInsensiticeString，所以String的equals也不接受CaseInsensiticeString作为参数。

所以有个准则，一般在覆写equals**只兼容同类型的变量**。

#### 违反传递性

传递性就是A等于B，B等于C，那么A也应该等于C。

假设我们定义一个类Cat。

```java
public class Cat()
{
    private int height;
    private int weight;
    public Cat(int h, int w)
    {
        this.height = h;
        this.weight = w;
    }
    
    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Cat))
            return false;
        Cat c = (Cat) o;
        return c.height == height && c.weight == weight; 
    }
}

```

名人有言，不管黑猫白猫抓住老鼠就是好猫，我们又定义一个类ColorCat:

```java
public class ColorCat extends()
{
    private String color;
    public ColorCat(int h, int w, String color)
    {
        super(h, w);
        this.color = color;
    }

```

我们在实现equals方法时，可以加上颜色比较，但是加上颜色就不兼容和普通猫作对比了，这里我们忘记上面要求只兼容同类型变量的建议，定义一个兼容普通猫的equals方法，在“混合比较”时忽略颜色。

```java
@Override
public boolean equals(Object o) {
  	//不是Cat或者ColorCat，直接false
    if (! (o instanceof Cat))
        return false; 
    if (! (o instanceof ColorCat))
        return o.equals(this);
    //不是彩猫，那一定是普通猫，忽略颜色对比
    return super.equals(o)&&((ColorCat)o).color.equals(color); //这时候才比较颜色
}

```

假设我们定义了猫：

```java
ColorCat whiteCat = new ColorCat(1,2,"white");
Cat cat = new Cat(1,2);
ColorCat blackCat = new ColorCat(1,2,"black");
```

此时有whiteCat等于cat，cat等于blackCat，但是whiteCat不等于blackCat，所以不满足传递性要求。。

所以在覆写equals时，一定要遵守上述的5大军规，不然总是有麻烦事找上门来。

## 面试官，那你在工作中有覆写equals方法的诀窍吗，比如写一下String里面的equals？

------

手写：

```java
 public boolean equals(Object anObject) {
        if (this == anObject) {
            return true;
        }
        if (anObject instanceof String) {
            String anotherString = (String)anObject;
            int n = value.length;
            if (n == anotherString.value.length) {
                char v1[] = value;
                char v2[] = anotherString.value;
                int i = 0;
                while (n-- != 0) {
                    if (v1[i] != v2[i])
                        return false;
                    i++;
                }
                return true;
            }
        }
        return false;
    }
```

上面的equals有以下几点诀窍：

- **使用==操作符检查“参数是否为这个对象的引用”**：如果是对象本身，则直接返回，拦截了对本身调用的情况，算是一种性能优化。
- **使用instanceof操作符检查“参数是否是正确的类型”**：如果不是，就返回false，正如对称性和传递性举例子中说得，不要想着兼容别的类型，很容易出错。在实践中检查的类型多半是equals所在类的类型，或者是该类实现的接口的类型，比如Set、List、Map这些集合接口。
- **把参数转化为正确的类型**： 经历了上一步的检测，基本会成功。
- **对于该类中的“关键域”，检查参数中的域是否与对象中的对应域相等**：基本类型的域就用`==`比较，float域用Float.compare方法，double域用Double.compare方法，至于别的引用域，我们一般递归调用它们的equals方法比较，加上判空检查和对自身引用的检查，一般会写成这样：`(field == o.field || (field != null && field.equals(o.field)))`,而上面的String里使用的是数组，所以只要把数组中的每一位拿出来比较就可以了。
- **编写完成后思考是否满足上面提到的对称性，传递性，一致性等等**。

还有一些注意点。

#### 覆盖equals时一定要覆盖hashCode

#### equals函数里面一定要是Object类型作为参数

#### equals方法本身不要过于智能，只要判断一些值相等即可。

## 面试官，刚才提到了hashCode，有什么用？

------

hashCode用于返回对象的hash值，主要用于查找的快捷性，因为hashCode也是在Object对象中就有的，所以所有Java对象都有hashCode，在HashTable和HashMap这一类的散列结构中，都是通过hashCode来查找在散列表中的位置的。

### 如果两个对象equals，那么它们的hashCode必然相等，

### 但是hashCode相等，equals不一定相等。

以HashMap为例，使用的是链地址法来处理散列，假设有一个长度为8的散列表

```bash
0 1 2 3 4 5 6 7
```

那么，当往里面插数据时，是以hashCode作为key插入的，一般hashCode（key）^（map.长度-1）得到所在的索引，如果所在索引处有元素了，则使用一个链表，把多的元素不断链接到该位置，这边也就是大概提一下HashMap原理。

所以hashCode的作用就是找到索引的位置，然后再用equals去比较元素是不是相等，形象一点就是先找到桶（bucket），然后再在里面找东西。

## 面试官：你知道有哪些覆写hashCode的诀窍？

------

一个好的hashCode的方法的目标：**为不相等的对象产生不相等的散列码**，同样的，相等的对象必须拥有相等的散列码。

好的散列函数要把实例均匀的分布到所有散列值上，结合前人的经验可以采取以下方法：

> 引自Effective Java

1. 把某个非零的常数值，比如17，保存在一个int型的result中；

1. 对于每个关键域f（equals方法中设计到的每个域），作以下操作：

   **a**. 为该域计算int类型的散列码；

   ```
    i.如果该域是boolean类型，则计算(f?1:0),
    ii.如果该域是byte,char,short或者int类型,计算(int)f,
    iii.如果是long类型，计算(int)(f^(f>>>32)).
    iv.如果是float类型，计算Float.floatToIntBits(f).
    v.如果是double类型，计算Double.doubleToLongBits(f),然后再计算long型的hash值
    vi.如果是对象引用，则递归的调用域的hashCode，如果是更复杂的比较，则需要为这个域计算一个范式，然后针对范式调用hashCode，如果为null，返回0
    vii. 如果是一个数组，则把每一个元素当成一个单独的域来处理。
   
   ```

   **b**.result = 31 * result + c;

1. 返回result

1. 编写单元测试验证有没有实现所有相等的实例都有相等的散列码。

这里再说下2.b中为什么采用`31*result + c`,乘法使hash值依赖于域的顺序，如果没有乘法那么所有顺序不同的字符串String对象都会有一样的hash值，而31是一个奇素数，如果是偶数，并且乘法溢出的话，信息会丢失，31有个很好的特性是`31*i ==(i<<5)-i`,即2的5次方减1，虚拟机会优化乘法操作为移位操作的。