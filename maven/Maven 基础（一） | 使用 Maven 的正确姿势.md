### 依赖寻找顺序

面试官 👨‍：先来一道小题热热身，Maven 是如何寻找依赖的？

小明 🤪：首先会去*本地仓库*寻找，然后会去公司的*私服仓库*寻找，一般私服仓库存的都是公司自己开发的 jar 包，最后会去 由Apache 团队来维护*中央仓库*寻找，一旦在一个地方找到就不再寻找。面试官，加点难度啊。太简单

面试官 👨‍：小伙子，很飘啊，那我接着问你，我们pom文件具有许多标签，不少同学对各种标签和使用混淆不清，先来问你常见的几个标签的作用

小明 🤪：放马过来

### 如何确认这个依赖的唯一表示

面试官 👨‍：在我们项目中具有众多依赖，程序是如何确定这个依赖的位置呢？

小明 🤪：这个简单

通常情况下，我们利用 *groupId*、*artifactId*、*version* 标签来确认这个依赖的唯一坐标

```xml
<groupId>：企业网址反写+项目名
<artifactId>：项目名-模块名
<version>：当前版本

<groupId>com.juejin.business</groupId>
<artifactId>juejin-image-web</artifactId>
<version>1.0.0-SNAPSHOT</version>
```

### scope 范围有哪些

面试官 👨‍：scope 标签在我们的项目中经常使用到，你知道常见的范围有哪些吗？

小明 🤪：这个难不倒我

我们常用的 scope 的范围是

|          | compile | test | provided |
| -------- | ------- | ---- | -------- |
| 主程序   | √       | x    | √        |
| 测试程序 | √       | √    | √        |
| 参与部署 | √       | x    | x        |

- compile：默认范围，编译、测试、运行都有效
- provided：编译和测试有效，运行不会被加入，如tomcat依赖
- runtime：在测试和运行的时候有效，编译不会被加入，比如jdbc驱动jar
- test：测试阶段有效，比如junit
- system：与provided一致，编译和测试阶段有效，但与系统关联，可移植性差
- import：导入的范围，它只是用在dependencyManagement中，表示从其它的pom中导入dependency的配置

### scope的依赖是如何传递的

面试官 👨‍： 回答的不错，那么如果项目 A 依赖 项目B 的范围为 provided ，项目B 依赖 项目C 的范围为 runtime 的，最终项目A 依赖项目C 的范围为什么？

小明 🤪：依赖的范围为 provided 让我画个图给你看

[![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/1460000040290719.png)](https://link.segmentfault.com/?enc=rOnZWzPSTfY5BG%2FUlZcZdA%3D%3D.f9Xjbev71GkbWLfqnl55%2FIKFk6oA9IyG%2Bsl9Sjih5Ron%2FtZgla7EyEjUGHKs9XXKx7e9tjKrCffVSpLBpGBulW5rxZ3wy%2FW53kevrQaviL8%3D)

### 如何排除依赖

面试官 👨‍： 在我们引入许多依赖之后，大概率会产生依赖冲突，你是如何解决的？

小明 🤪：假设 *juejin-convert-web* 这个依赖发生了冲突，我会这样解决，首先找到冲突项目

1-通过 *exclusions* 标签实现。冲突项目依赖
*juejin-image-web*项目的时候，主动排除传递的*juejin-convert-web*项目依赖

```xml
 <dependency>
        <groupId>com.juejin.business</groupId>
        <artifactId>juejin-image-web</artifactId>
        <version>1.0.0-SNAPSHOT</version>
        <exclusions>
            <exclusion>
                <groupId>com.juejin.business</groupId>
                <artifactId>juejin-convert-web</artifactId>
            </exclusion>
        </exclusions>
    </dependency>
```

2-通过*optional*实现

修改 *juejin-image-web* 项目的 pom.xml：

```xml
<dependency>
        <groupId>com.juejin.business</groupId>
        <artifactId>juejin-convert-web</artifactId>
        <version>1.0.0-SNAPSHOT</version>
        <optional>true</optional>
 </dependency>
```

### 依赖传递原则

面试官 👨‍： 看你对 Maven 的依赖传递是有一定了解的，你详细说说这个 Maven 依赖传递的原则。

小明 🤪：好，Maven 依赖传递的原则有两点，第一点是*最短路径原则*，第二点是*最先声明原则*

举个例子说明

a->b->c(2.0)

a->c(1.0)

最后采取 c(1.0) 这个版本，因为它短啊。

再来个例子说明一下第二个原则

a->b->c(2.0)

a->d->c(1.0)

因为b先声明引入了c，所以采取c(2.0)

*当然如果我们在 a 中直接依赖了 c 肯定是以我们 a 的项目依赖的 c 版本为主，近亲原则*

### Maven 的生命周期

面试官 👨‍： Maven 有三套相互独立的生命周期，分别是，*Clean Lifecycle* 在进行真正的构建之前进行一些清理工作，*Default Lifecycle* 构建的核心部分，编译，测试，打包，安装，部署等等，*Site Lifecycle* 生成项目报告，站点，发布站点，并且在 idea 的侧边栏你也可以看到

[![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/1460000040290720.png)](https://link.segmentfault.com/?enc=Ia5Gmhzva1mspjqexXMK3Q%3D%3D.%2FB%2FWlFu%2Byd13TjoDuqUX71M0%2BxaFFsrAaD5hOyaar%2FjbElf%2B1gFqLTpokIfL4oLXxXIQxhq9NVkQWGxV%2Fc9ZHTLowpSh8i4B2XrbGa9NVQw%3D)

你展开讲讲这些生命周期做了什么事？

小明 🤪：好

```markdown
clean 移除所有上一次构建生成的文件
validate：验证工程是否正确，所有需要的资源是否可用
compile：编译项目的源代码
test：使用合适的单元测试框架来测试已编译的源代码。这些测试不需要已打包和布署。
package：把已编译的代码打包成可发布的格式，比如 jar、war 等。
verify：运行所有检查，验证包是否有效且达到质量标准。
install：把包安装到maven本地仓库，可以被其他工程作为依赖来使用
site 生成项目的站点文档
deploy：在集成或者发布环境下执行，将最终版本的包拷贝到远程的repository，使得其他的开发者或者工程可以共享
```

### 在子项目中任意定义二方包版本号

面试官 👨‍： 我们新来的一个实习生，在子项目中随意定义了一个二方包的版本号，你觉得合不合适，

小明 🤪：不大合适，因为在我们协作开发同一个应用的时候，如果大家都随意修改二方包的版本号，那么分支合并的时候一定冲突，同时引用这个二方包的项目也一定会冲突，

所以我们包的版本管理都交由主 POM，禁止在子项目中单独声明要发布或者依赖的二方包

面试官 👨‍： 不错不错，小伙子明天来上班吧

小明 🤪：好嘞